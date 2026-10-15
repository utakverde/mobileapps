# Execution Plan Standard

Create plans under `docs/plans/YYYY-MM-DD-feature-name.md` for complex,
multi-file, data-sensitive, architectural, or release-related work.

Every plan must include:

## Objective
Describe the user-visible or developer-visible outcome.

## Current behavior
Record confirmed behavior from the repository. Separate facts from assumptions.

## Desired behavior
State the expected result and acceptance criteria.

## Scope
List included work and explicitly excluded work.

## Architecture and ownership
List affected modules and assign each task to one named agent. Avoid overlapping
write ownership.

## Interfaces and contracts
Document APIs, events, data models, file formats, database changes, save formats,
or platform interfaces affected by the work.

## Implementation sequence
Provide ordered, independently verifiable steps.

## Risks
Cover data loss, compatibility, security, performance, regression, deployment,
and rollback risks.

## Testing
List automated and manual checks, edge cases, and test data requirements.

## Rollback
Explain how to restore code, data, schemas, builds, or releases.

## Definition of done
Use objective, verifiable completion conditions. Do not treat generated code as
complete until relevant checks have actually run.
