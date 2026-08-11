param(
  [string]$StackName = "pillarprep-frontend",
  [string]$Region = "us-east-1",
  [string]$BucketName = ""
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
Write-Host "Building static frontend with model calls disabled..."

Push-Location $repoRoot
try {
  $env:VITE_PILLARPREP_STATIC_DEMO = "true"
  npm.cmd run build:aws-frontend
  if ($LASTEXITCODE -ne 0) {
    throw "Frontend build failed."
  }
} finally {
  Pop-Location
}

Invoke-Aws cloudformation deploy `
  --template-file $templatePath `
  --stack-name $StackName `
  --parameter-overrides FrontendBucketName=$BucketName `
  --region $Region

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