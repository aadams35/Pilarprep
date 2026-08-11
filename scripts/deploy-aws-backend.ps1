param(
  [string]$StackName = "pillarprep-bedrock",
  [string]$Region = "us-east-1",
  [string]$AllowedOrigin = "http://127.0.0.1:3002",
  [string]$BedrockModelId = "us.amazon.nova-micro-v1:0",
  [string]$PillarPrepApiKey = ""
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
    throw "AWS CLI command failed. Re-run with AWS CLI debug output only if needed."
  }
}

Require-Command aws

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$templatePath = Join-Path $repoRoot "backend\bedrock_lambda\template.yaml"
$packagedPath = Join-Path $repoRoot "work\pillarprep-packaged.yaml"
$workDir = Split-Path $packagedPath -Parent
New-Item -ItemType Directory -Path $workDir -Force | Out-Null

$identityJson = Invoke-Aws sts get-caller-identity --output json | ConvertFrom-Json
$accountId = $identityJson.Account
if (-not $accountId) {
  throw "Could not determine AWS account. Run aws configure sso or aws configure first."
}

$bucketName = "pillarprep-deploy-$accountId-$Region".ToLowerInvariant()
Write-Host "Using AWS account $accountId in $Region"
Write-Host "Packaging bucket: $bucketName"

$bucketExists = $false
try {
  Invoke-Aws s3api head-bucket --bucket $bucketName --region $Region | Out-Null
  $bucketExists = $true
} catch {
  $bucketExists = $false
}

if (-not $bucketExists) {
  Write-Host "Creating packaging bucket..."
  Invoke-Aws s3 mb "s3://$bucketName" --region $Region | Out-Null
  Invoke-Aws s3api wait bucket-exists --bucket $bucketName --region $Region

  $publicAccessBlock = '{"BlockPublicAcls":true,"IgnorePublicAcls":true,"BlockPublicPolicy":true,"RestrictPublicBuckets":true}'
  Invoke-Aws s3api put-public-access-block `
    --bucket $bucketName `
    --public-access-block-configuration $publicAccessBlock `
    --region $Region | Out-Null
}

Invoke-Aws cloudformation package `
  --template-file $templatePath `
  --s3-bucket $bucketName `
  --output-template-file $packagedPath `
  --region $Region | Out-Null

Invoke-Aws cloudformation deploy `
  --template-file $packagedPath `
  --stack-name $StackName `
  --capabilities CAPABILITY_IAM `
  --parameter-overrides BedrockModelId=$BedrockModelId AllowedOrigin=$AllowedOrigin PillarPrepApiKey=$PillarPrepApiKey `
  --region $Region

Write-Host ""
Write-Host "Stack outputs:"
Invoke-Aws cloudformation describe-stacks `
  --stack-name $StackName `
  --region $Region `
  --query "Stacks[0].Outputs" `
  --output table