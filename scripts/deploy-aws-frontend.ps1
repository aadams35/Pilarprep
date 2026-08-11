param(
  [string]$StackName = "pillarprep-frontend",
  [string]$Region = "us-east-1",
  [string]$BucketName = "",
  [string]$ResourcePrefix = "pillarprep-demo",
  [string]$ProjectName = "PilarPrep",
  [string]$EnvironmentName = "demo",
  [string]$Owner = "austin-adams",
  [string]$CostCenter = "hackathon",
  [string]$WebACLId = "",
  [string]$CloudFrontPriceClass = "",
  [string]$BackendStackName = "pillarprep-bedrock",
  [string]$BackendApiUrl = "",
  [string]$BackendRegion = "",
  [string]$CognitoIdentityPoolId = ""
)

$ErrorActionPreference = "Stop"

function Require-Command($Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name is required but was not found on PATH."
  }
}

function Invoke-Aws {
  & aws @args
  if ($LASTEXITCODE -ne 0) {
    throw "AWS CLI command failed: aws $($args -join ' ')"
  }
}

Require-Command aws
Require-Command npm.cmd

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$templatePath = Join-Path $repoRoot "backend\frontend_static\template.yaml"
$distPath = Join-Path $repoRoot "dist\aws-frontend"

$identityJson = Invoke-Aws sts get-caller-identity --output json | ConvertFrom-Json
$accountId = $identityJson.Account
if (-not $accountId) {
  throw "Could not determine AWS account. Run aws configure sso or aws configure first."
}

if (-not $BucketName) {
  $BucketName = "pillarprep-frontend-$accountId-$Region".ToLowerInvariant()
}

Write-Host "Using AWS account $accountId in $Region"
Write-Host "Frontend bucket: $BucketName"

if (-not $BackendRegion) {
  $BackendRegion = $Region
}

if (-not $BackendApiUrl -or -not $CognitoIdentityPoolId) {
  try {
    $backendOutputs = Invoke-Aws cloudformation describe-stacks `
      --stack-name $BackendStackName `
      --region $BackendRegion `
      --query "Stacks[0].Outputs" `
      --output json | ConvertFrom-Json

    if (-not $BackendApiUrl) {
      $apiOutput = $backendOutputs | Where-Object { $_.OutputKey -eq "BriefApiUrl" } | Select-Object -First 1
      $BackendApiUrl = $apiOutput.OutputValue
    }

    if (-not $CognitoIdentityPoolId) {
      $identityOutput = $backendOutputs | Where-Object { $_.OutputKey -eq "DemoIdentityPoolId" } | Select-Object -First 1
      $CognitoIdentityPoolId = $identityOutput.OutputValue
    }
  } catch {
    Write-Host "No backend IAM demo outputs detected. Static build will stay demo-only."
  }
}

$hostedIamEnabled = [bool]($BackendApiUrl -and $CognitoIdentityPoolId)
if ($hostedIamEnabled) {
  Write-Host "Building static frontend with IAM-signed model calls enabled..."
} else {
  Write-Host "Building static frontend with model calls disabled..."
}

if (-not $WebACLId) {
  try {
    $existingDistributionId = Invoke-Aws cloudformation describe-stacks `
      --stack-name $StackName `
      --region $Region `
      --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue | [0]" `
      --output text

    if ($existingDistributionId -and $existingDistributionId -ne "None") {
      $existingWebAcl = Invoke-Aws cloudfront get-distribution-config `
        --id $existingDistributionId `
        --query "DistributionConfig.WebACLId" `
        --output text

      if ($existingWebAcl -and $existingWebAcl -ne "None") {
        $WebACLId = $existingWebAcl
        Write-Host "Preserving CloudFront Web ACL attachment."
      }
    }
  } catch {
    Write-Host "No existing CloudFront Web ACL detected."
  }
}

Push-Location $repoRoot
try {
  $env:VITE_PILLARPREP_STATIC_DEMO = "true"
  $env:VITE_PILLARPREP_BACKEND_URL = if ($hostedIamEnabled) { $BackendApiUrl } else { "" }
  $env:VITE_PILLARPREP_BACKEND_REGION = if ($hostedIamEnabled) { $BackendRegion } else { "" }
  $env:VITE_PILLARPREP_COGNITO_IDENTITY_POOL_ID = if ($hostedIamEnabled) { $CognitoIdentityPoolId } else { "" }
  npm.cmd run build:aws-frontend
  if ($LASTEXITCODE -ne 0) {
    throw "Frontend build failed."
  }
} finally {
  Pop-Location
}

$parameterOverrides = @(
  "ResourcePrefix=$ResourcePrefix",
  "ProjectName=$ProjectName",
  "EnvironmentName=$EnvironmentName",
  "Owner=$Owner",
  "CostCenter=$CostCenter",
  "FrontendBucketName=$BucketName",
  "WebACLId=$WebACLId",
  "CloudFrontPriceClass=$CloudFrontPriceClass"
)

$stackTags = @(
  "Name=$StackName",
  "Project=$ProjectName",
  "Application=sa-briefing-generator",
  "Environment=$EnvironmentName",
  "Owner=$Owner",
  "CostCenter=$CostCenter",
  "ManagedBy=cloudformation",
  "Repository=aadams35/Pilarprep",
  "DataClassification=demo"
)

$deployArgs = @(
  "cloudformation",
  "deploy",
  "--template-file",
  $templatePath,
  "--stack-name",
  $StackName,
  "--parameter-overrides"
) + $parameterOverrides + @(
  "--tags"
) + $stackTags + @(
  "--region",
  $Region
)

Invoke-Aws @deployArgs

$outputs = Invoke-Aws cloudformation describe-stacks `
  --stack-name $StackName `
  --region $Region `
  --query "Stacks[0].Outputs" `
  --output json | ConvertFrom-Json

$bucketOutput = $outputs | Where-Object { $_.OutputKey -eq "FrontendBucketName" } | Select-Object -First 1
$distributionOutput = $outputs | Where-Object { $_.OutputKey -eq "CloudFrontDistributionId" } | Select-Object -First 1
$urlOutput = $outputs | Where-Object { $_.OutputKey -eq "FrontendUrl" } | Select-Object -First 1

if (-not $bucketOutput.OutputValue -or -not $distributionOutput.OutputValue) {
  throw "CloudFormation outputs did not include the frontend bucket and distribution ID."
}

$bucket = $bucketOutput.OutputValue
$distributionId = $distributionOutput.OutputValue
$url = $urlOutput.OutputValue

Invoke-Aws s3 sync $distPath "s3://$bucket" `
  --delete `
  --exclude "index.html" `
  --cache-control "public,max-age=31536000,immutable" `
  --region $Region

Invoke-Aws s3 cp (Join-Path $distPath "index.html") "s3://$bucket/index.html" `
  --cache-control "no-cache,no-store,must-revalidate" `
  --content-type "text/html" `
  --region $Region

Invoke-Aws cloudfront create-invalidation `
  --distribution-id $distributionId `
  --paths "/*" | Out-Null

Write-Host ""
Write-Host "Frontend deployed: $url"
Write-Host "CloudFront distribution: $distributionId"
Write-Host "S3 bucket: $bucket"