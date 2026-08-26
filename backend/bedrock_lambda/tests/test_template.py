import re
import unittest
from pathlib import Path


TEMPLATE_PATH = Path(__file__).resolve().parents[1] / "template.yaml"


class TemplateSecurityTests(unittest.TestCase):
    def test_brief_roles_can_use_only_the_stack_data_key(self):
        template = TEMPLATE_PATH.read_text(encoding="utf-8")

        for policy_name in ("data-key-access", "worker-data-key-access"):
            policy_match = re.search(
                rf'PolicyName: !Sub "\$\{{ResourcePrefix\}}-{policy_name}"(?P<body>.*?)- !Ref "AWS::NoValue"',
                template,
                re.DOTALL,
            )
            self.assertIsNotNone(policy_match, f"Missing {policy_name} policy")
            policy = policy_match.group("body")
            for action in (
                "kms:Decrypt",
                "kms:DescribeKey",
                "kms:Encrypt",
                "kms:GenerateDataKey*",
                "kms:ReEncrypt*",
            ):
                self.assertIn(action, policy)
            self.assertIn("Resource: !GetAtt DataEncryptionKey.Arn", policy)
            self.assertNotIn('Resource: "*"', policy)


if __name__ == "__main__":
    unittest.main()