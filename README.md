# Workflow Observer #

A full-stack observability platform for monitorying GitHub repository:
user access, issues, workflow health, CD/CI events

## Project Overview ##

Workflow Observer is an observability platform for GitHub designed to centralize repository activity and workflow health accross multiple repositories.

This project started as a way for me to both expand and enhance my understanding of the GitHub ecosystem while preparing for roles focused on integrations, developer tooling, and technical products. So instead of learning GitHub's API and webhook system by itself, I wanted to build an application that used them in a realistic event-driven workflow. Something I imagine would be quite applicable to the roles I'm interested in. 

The application receives webhook events from GitHub and processes them using a FastAPI backend. Events from sources such as pushes, pull requests, issues, workflow runs, and repository membership changes are dispatched to dedicated handlers, normalized into a common data model, and persisted in PostgreSQL. Event-specific information is retained as structured JSON so that the database can accommodate GitHub's varied event payloads without requiring a separate schema for every event type.

It then exposes this information through a REST API and a React/TypeScript dashboard, where repository activity and workflow health can be explored using repository, event, status, time-range, and other filters. The system also supports alerts for significant workflow events through Slack.

