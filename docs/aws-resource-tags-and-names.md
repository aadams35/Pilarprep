# AWS Resource Names And Tags

PillarPrep uses consistent names and tags so the hackathon AWS account is easy to search, explain, and clean up.

## Naming Standard

Default deployment values:

```text
ResourcePrefix=pillarprep-demo
ProjectName=PillarPrep
EnvironmentName=demo
Owner=austin-adams
CostCenter=hackathon
```

Use `ResourcePrefix` for human-readable resource names and `Name` tags. Keep it lowercase and hyphenated.

Current safe display names:

| Area | Resource | Name / display value |
| --- | --- | --- |
| Backend | API Gateway HTTP API | `pillarprep-demo-brief-api` |
| Backend | Lambda function Name tag | `pillarprep-demo-brief-generator` |
| Backend | S3 artifact bucket Name tag | `pillarprep-demo-brief-artifacts` |
| Backend | DynamoDB table Name tag | `pillarprep-demo-project-state` |
| Backend | CloudWatch dashboard | `pillarprep-demo-ops-dashboard` |
| Frontend | S3 frontend bucket Name tag | `pillarprep-demo-web-assets` |
| Frontend | CloudFront distribution Name tag | `pillarprep-demo-cloudfront-web` |
| Frontend | CloudFront OAC | `pillarprep-demo-frontend-oac` |
| Deployment | CloudFormation package bucket Name tag | `pillarprep-demo-cfn-package` |

## Required Tags

Every taggable CloudFormation resource should carry:

```text
Name=<resource-specific name>
Project=PillarPrep
Application=sa-briefing-generator
Environment=demo
Owner=austin-adams
CostCenter=hackathon
ManagedBy=cloudformation
Repository=aadams35/Pilarprep
DataClassification=demo
```

The deployment scripts also apply the same standard to the CloudFormation stacks. The backend deploy script additionally tags the S3 packaging bucket because that bucket is created outside the application templates.

## Safe Rename Rule

Do not add physical names to stateful resources unless you are intentionally migrating them. In CloudFormation, changing physical names for S3 buckets, DynamoDB tables, and Lambda functions can require replacement. For the hackathon demo, use `Name` tags and safe display-name properties first so the existing CloudFront URL and stored artifacts are not disrupted.

When a true physical rename is needed later, create a migration plan:

1. Create the new named resource.
2. Copy or export data from the old resource.
3. Update environment variables and policies.
4. Validate the app.
5. Retire the old resource after the demo window.