    # Project Zero Hour: Product Requirements & Architecture

    ## 1. Project Overview
    **Zero Hour** is a technical assessment and training platform that validates engineering skills through debugging rather than algorithmic puzzles. It places users into "broken" production-grade environments and tasks them with diagnosing and fixing real-world issues.

    **Core Value Proposition:**
    *   **For Students:** Escape "Tutorial Hell" by gaining experience with messy, real-world code.
    *   **For Recruiters:** A "Verified Fixer" signal that proves a candidate can handle existing codebases, not just write scripts from scratch.

    ---

    ## 2. User Journey (The "Happy Path")
    1.  **Onboarding:** User selects their stack (e.g., React/Node, Python/Django) and difficulty level.
    2.  **The Drop:** The user enters the "War Room" (IDE Interface).
        *   **Left Pane:** Code Editor (VS Code style).
        *   **Middle Pane:** Live Preview. They see a real app (e.g., an E-commerce store) rendering. They interact with it, and it crashes or behaves incorrectly.
        *   **Right Pane:** AI Mentor Chat.
    3.  **The Diagnosis:** The user investigates the code and logs. The AI Mentor offers Socratic hints ("Are you sure that API call is returning what you think it is?").
    4.  **The Fix:** User patches the code. The Live Preview updates instantly (HMR).
    5.  **Submission:** User clicks "Submit Fix."
        *   **System Check:** Runs automated integration tests.
        *   **AI Check:** Verifies the logic isn't a hacky workaround.
    6.  **Victory:** User gains XP/Rank and this bug is added to their "Fixer Portfolio."

    ---

    ## 3. Core Features
    *   **The War Room (IDE):** A browser-based development environment backed by cloud containers.
    *   **The Ingestion Engine:** Automated pipeline that finds suitable GitHub issues, forks the repo, reverts to the "broken" commit, and generates a challenge description.
    *   **The Socratic AI:** An LLM agent (fine-tuned or prompted with system instructions) that refuses to write code and prioritizes guiding questions.
    *   **Fixer Profile:** A public resume showing specific classes of bugs fixed (e.g., "Memory Leaks," "Race Conditions," "CSS Layouts").

    ---

    ## 4. Technical Architecture

    ### A. The Frontend (The Interface)
    *   **Framework:** Next.js (React). Great for SEO (marketing pages) and dynamic dashboarding.
    *   **State Management:** Zustand or Redux Toolkit (complex editor state).
    *   **IDE Component:** Monaco Editor (the engine behind VS Code) for a familiar coding experience.

    ### B. The Backend (The Orchestrator)
    *   **API Server:** Node.js (Express/NestJS) or Go. Handles user auth, billing, and spinning up sandboxes.
    *   **Database:** PostgreSQL. Stores user profiles, challenge metadata, and "Fixer" records.
    *   **Task Queue:** Redis + BullMQ. Essential for managing the queue of container spin-ups so the server doesn't crash under load.

    ### C. The Infrastructure (The Sandbox)
    *   **Containerization:** Docker. Every user session runs in an isolated Docker container.
    *   **Orchestration:**
        *   *MVP:* Fly.io or AWS Fargate (easier to manage).
        *   *Scale:* Kubernetes (Google GKE or AWS EKS) for fine-grained control over thousands of student pods.
    *   **Proxying:** A reverse proxy (like Traefik or Nginx) routes "Live Preview" traffic from the user's browser to their specific dynamic Docker container.

    ### D. The AI Layer
    *   **Model:** OpenAI GPT-4o or Claude 3.5 Sonnet (excellent at coding logic).
    *   **Integration:** The AI needs context. It is fed the "Diff" (the solution) and the user's current code so it knows exactly how far off they are.

    ---

    ## 5. Data Model (Conceptual)
    *   **User:** `id`, `name`, `github_handle`, `xp_points`, `role` (student/recruiter).
    *   **Challenge:** `id`, `title`, `repo_url`, `broken_commit_hash`, `solution_commit_hash`, `difficulty_score` (1-10), `stack` (e.g., "MERN").
    *   **Submission:** `id`, `user_id`, `challenge_id`, `status` (pass/fail), `code_snapshot`, `ai_conversation_log`.

    ---

    ## 6. Development Phases

    ### Phase 1: The "Manual" MVP (Months 1-2)
    *   Build the Web IDE and Docker sandbox runner manually.
    *   Manually curate 10-20 "Golden Standard" bugs (don't build the auto-scraper yet).
    *   Focus on the React/Node stack only.
    *   **Goal:** Get 50 users to fix one bug successfully.

    ### Phase 2: The Automation (Months 3-4)
    *   Build the GitHub Ingestion Engine.
    *   Implement the "Difficulty Ranking" algorithm (Diff size analysis).
    *   Expand to Python/Flask stack.
    *   **Goal:** Infinite content stream.

    ### Phase 3: The Recruiter Dashboard (Months 5-6)
    *   Build the "Search by Skill" interface for companies.
    *   Implement "Verified Fixer" public profiles.
    *   **Goal:** First B2B Pilot.

    ---

    ## 7. Potential Challenges & Solutions

    | Challenge | Solution |
    | :--- | :--- |
    | **Cost of Compute** | Running Docker containers is expensive. Set strict timeouts (kill container after 15 mins of inactivity) and use "Micro-VMs" (like Firecracker) eventually. |
    | **Security** | Users are running arbitrary code on your servers. Disable network access (except for localhost) inside the containers and use non-root users. |
    | **"Bad" Content** | GitHub issues might be poorly documented. Use LLMs to rewrite the issue description into a clear "Mission Brief" before showing it to the user. |
