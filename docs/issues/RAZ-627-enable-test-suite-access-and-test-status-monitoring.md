---
title: "Enable test suite access and test status monitoring"
type: Task
id: RAZ-627
status: in-progress
state: In Review
state_type: started
project: "WeDance Governance"
labels: ["qa"]
assignee: "Vitali"
creator: "Vitali"
priority: "High"
estimate: null
parent: null
created: 2026-10-18T19:10:48.666Z
completed: null
canceled: null
due: null
links: ["https://github.com/razbakov/wedance-org/pull/21"]
linear_url: https://linear.app/alosha/issue/RAZ-627/enable-test-suite-access-and-test-status-monitoring
exported: 2026-10-25
---

# RAZ-627 — Enable test suite access and test status monitoring

@vitali.weinstein.wedance needs access to all project test suites.

The project owner should propose a solution to integrate Grafana and Prometheus into the test environment. The QA Lead needs a dashboard to track test status.

## Required solution report

Deliver the solution report as a Markdown document (.md), covering all sections below.

### Installation process

* Describe how Grafana and Prometheus will be deployed and connected to the test environment.
* Document prerequisites, installation and configuration steps, and how test results or metrics will reach Prometheus and appear in Grafana.
* Explain how to verify the installation and confirm that the dashboard reflects test results correctly.
* Document upgrade, rollback, and maintenance procedures.

### System environment

* Describe the existing test environment and identify any information still needed to finalize the solution.
* Specify hosting and deployment requirements, supported versions, CPU, memory, storage, and network connectivity.
* Describe integration with test suites and test execution pipelines, including any required exporters or adapters.
* Document access permissions, authentication, secrets management, and how the QA Lead will access the dashboard and all project test suites.
* Define metrics retention and storage requirements, and identify dependencies and constraints.

### Test status dashboard

* Propose the dashboard views and metrics needed to report test status, including passed, failed, skipped, and running tests where available.
* Explain how results will be grouped by project, test suite, environment, and test run, and how users can identify the latest results and historical trends.
* State data refresh expectations and any limitations in the available test data.

### Costs

* Compare relevant deployment options, including self-hosted and managed services where applicable.
* Itemize one-time setup costs and recurring costs for compute, storage, networking, licenses or subscriptions, and maintenance.
* State pricing sources, currency, billing period, usage assumptions, and what is included or excluded.
* Explain how costs change with test volume, metrics volume, and retention. Mark unknown costs explicitly rather than treating them as zero.

### Recommendation

Provide a recommended approach with trade-offs, dependencies, open questions, and the steps needed to validate the solution before implementation.

## Links

- [docs: test monitoring solution report (RAZ-627)](https://github.com/razbakov/wedance-org/pull/21)

## Comments

### Linear · 2026-10-18 19:24 UTC

This thread is for an agent session with forge.

### Forge · 2026-10-18 19:34 UTC

### 👀 Merged — ready for your review — Test monitoring solution report added to governance docs

**Live:** https://org.wedance.vip/docs/03_Coordination/2026-10-18-test-monitoring-solution-report
**PR:** https://github.com/razbakov/wedance-org/pull/21

Nothing to try — internal change (docs only — solution report for Grafana/Prometheus test monitoring integration).

### Vitali · 2026-10-19 19:03 UTC

@razbakov.aleksey Please confirm
