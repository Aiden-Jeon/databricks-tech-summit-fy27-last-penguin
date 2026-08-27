# CI/CD

The GitHub Actions pipeline validates both Databricks Asset Bundle targets on
pull requests. A merge to `main` deploys `prod`; a manual run can deploy either
`dev` or `prod`.

## Databricks target

- Project: `databricks-tech-summit-fy27-last-penguin`
- Workspace: `https://fe-sandbox-last-penguin.cloud.databricks.com`
- Local CLI profile: `fe-sandbox-last-penguin`

Validate or deploy locally:

```bash
databricks bundle validate --target dev --profile fe-sandbox-last-penguin
databricks bundle deploy --target dev --profile fe-sandbox-last-penguin
```

## GitHub configuration

Both the `dev` and `prod` GitHub environments need:

- Variable `DATABRICKS_HOST`
- Secret `DATABRICKS_CLIENT_ID`
- Secret `DATABRICKS_CLIENT_SECRET`

Use a Databricks service principal for CI/CD. Do not upload a local OAuth
profile or personal access token to GitHub.

The deploy step provisions the bundle resources. The `nimbus_setup` job remains
an explicit operation and is not automatically run on every deployment:

```bash
databricks bundle run nimbus_setup --target dev --profile fe-sandbox-last-penguin
```
