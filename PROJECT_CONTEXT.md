# Project Context

## Project Overview

Enterprise ITSM Helpdesk AI Copilot is an end-to-end helpdesk assistant designed for corporate IT service management teams. The goal is to combine incident ticketing, knowledge base search, and AI-assisted troubleshooting into one modern service desk platform.

## Business Problem

Large enterprises struggle with repetitive IT support requests, inconsistent ticket triage, and poor knowledge reuse. This project aims to reduce time-to-resolution, increase first-contact resolution, and surface consistent support guidance across helpdesk agents, administrators, and employees.

## Intended Users

- Employees / end users seeking help with IT issues.
- IT support agents triaging incidents, managing ticket queues, and collaborating on resolutions.
- Administrators overseeing service desk metrics, system settings, and knowledge base health.

## Expected Application Behavior

- Employees can browse the landing page, authenticate, raise incident tickets, and use AI chat for automated guidance.
- Agents can review ticket queues, update ticket metadata, add notes, and resolve incidents.
- Administrators can access command center metrics, manage support workflows, and restore demo state.
- The system should integrate knowledge base retrieval and AI summaries without breaking the ticketing workflow.

## Current Architecture Summary

- Frontend: React + Vite single-page application with Tailwind styles and client-side mock state.
- Backend: FastAPI application exposing auth and ticket APIs, with SQLAlchemy for persistence.
- Database: SQLite by default, with SQLAlchemy session management and seed/demo data.
- AI Layer: Designed to use generative models for chat and knowledge retrieval; currently placeholder/simulated.
- RAG Layer: Scaffolding exists for document ingestion and retrieval, but not fully implemented.

## Project Vision

The long-term vision is a production-ready ITSM Copilot that combines:
- AI-assisted incident analysis and root-cause summaries.
- RAG-powered knowledge base responses with source citations.
- Context-aware ticket creation and escalation.
- A secure, role-based service desk experience for employees, agents, and admins.

## Important Notes for Developers

- This repository is currently documentation-first: business logic should not be changed while updating docs.
- The frontend contains real routes and UI, but much of the backend integration is simulated or incomplete.
- Future development should preserve existing tickets, user roles, and the RAG/AI design intent.
