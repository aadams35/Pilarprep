param(
  [string]$StackName = "pillarprep-bedrock",
  [string]$Region = "us-east-1",
  [string]$AllowedOrigin = "http://127.0.0.1:3002",
  [string]$BedrockModelId = "anthropic.claude-3-5-sonnet-20241022-v2:0"
)

$ErrorActionPreference = "Stop"

function Require-Command($Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name is required but was not found on PATH."
  }
}

Require-Command aws

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$templatePath = Join-Path $repoRoot "backend\bedrock_lambda\template.yaml"
$packagedPath = Join-Path $repoRoot "work\pillarprep-packaged.yaml"
$workDir = Split-Path $packagedPath -Parent
New-Item -ItemType Directory -Path $workDir -Force | Out-Null

$identityJson = aws sts get-caller-identity --output json | ConvertFrom-Json
$accountId = $identityJson.Account
if (-not $accountId) {
  throw "Could not determine AWS account. Run aws configure sso or aws configure first."
}

$bucketName = "pillarprep-deploy-$accountId-$Region".ToLowerInvariant()
Write-Host "Using AWS account $accountId in $Region"
Write-Host "Packaging bucket: $bucketName"

$bucketExists = $false
try {
  aws s3api head-bucket --bucket $bucketName --region $Region | Out-Null
  $bucketExists = $true
} catch {
  $bucketExists = $false
}

if (-not $bucketExists) {
  if ($Region -eq "us-east-1") {
    aws s3api create-bucket --bucket $bucketName --region $Region | Out-Null
  } else {
    aws s3api create-bucket --bucket $bucketName --region $Region --create-bucket-configuration LocationConstraint=$Region | Out-Null
  }

  aws s3api put-public-access-block `
    --bucket $bucketName `
    --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true `
    --region $Region | Out-Null
}

aws cloudformation package `
  --template-file $templatePath `
  --s3-bucket $bucketName `
  --output-template-file $packagedPath `
  --region $Region | Out-Null

aws cloudformation deploy `
  --template-file $packagedPath `
  --stack-name $StackName `
  --capabilities CAPABILITY_IAM `
  --parameter-overrides BedrockModelId=$BedrockModelId AllowedOrigin=$AllowedOrigin `
  --region $Region

Write-Host ""
Write-Host "Stack outputs:"
aws cloudformation describe-stacks `
  --stack-name $StackName `
  --region $Region `
  --query "Stacks[0].Outputs" `
  --output table