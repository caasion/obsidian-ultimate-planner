<img width="1100" height="500" alt="holos_logo3_right" src="https://github.com/user-attachments/assets/8ad471bf-724b-468e-a143-23017f3940c7" />

**An integrated productivity system for Obsidian that bridges the gap between big-picture life planning and daily execution.**

Most productivity setups are fragmented — Google Calendar for scheduling, Obsidian for planning, a separate app for tasks. None of them connect "what am I focusing on this season of my life?" to "what am I actually doing today?"

Holos fixes that with a three-tier system built entirely inside Obsidian, with everything stored in plain markdown files you can read and edit directly.

---

## Demo

https://github.com/user-attachments/assets/0adbb3cd-8ad8-48ba-8204-7a00708c6e39

---

## How It Works

### Tracks and Projects
Tracks define what you're focusing on in a current phase of life. Think of them as the high-level areas that matter to you right now — work, health, a side project, a relationship. Each track has its own color, journal header, and time commitment target. Projects live inside tracks and drill into specific areas you're actively working on. Each project has a start and end date, a description, recurring habits, and tasks to complete.

<img width="1669" height="961" alt="image" src="https://github.com/user-attachments/assets/e4a5f169-e8ed-42dc-aca7-e2b72a338572" />

### The Planning Grid
The grid is where everything comes together. Each column is a day, each row is a track. This is your daily view — what you're doing today across every area of your life, all in one place.

<img width="1919" height="1002" alt="image" src="https://github.com/user-attachments/assets/c37ff102-c4b9-4d9e-964b-8750d9a2cc1c" />

Within each grid cell you can:
- Add tasks using plain text formatting (inspired by markdown — type it, it renders when you click away)
- Set time labels and durations on individual tasks
- Track time commitment per cell, automatically tallied in the corner
- Drag and drop tasks across days or within the same day
- Navigate infinitely forward and backward through your history
- Configure how many days are visible at once

Every cell links back to a markdown file. Everything you see in the grid is real, editable plain text in your vault.

---
### Task Syntax

<img width="392" height="211" alt="image" src="https://github.com/user-attachments/assets/cf1431c3-6437-4e06-b39c-2adcdabb89c1" />

```
- An event
- [ ] A task
- [-] Cancelled task
- [x] Completed task
- Event/task @ 10:00 [1 hr]
- Event/task @ 23:00 [100 min]
- [x] Half-completed [1/2 hr]
```

---

## Installation

Holos is not yet in the Obsidian community plugin registry. You can install it manually using [BRAT](https://github.com/TfTHacker/obsidian42-brat).

1. Install the BRAT plugin from the Obsidian community plugins
2. Open BRAT settings and click **Add Beta Plugin**
3. Enter the repository URL: `https://github.com/caasion/holos`
4. Enable Holos in your Obsidian plugin settings

---

## Status

Holos is actively in development (v3.0.0, 500+ commits). It is stable and usable as a daily driver — I use it every day myself. Some features are still being built out, including deeper Google Calendar integration and project-to-grid linking.

Issues, feedback, and contributions are welcome.

---

## Background

Holos started as a personal tool built around my own frustrations. The design went through three complete iterations before landing on what exists today — not just because the architecture evolved, but because understanding how I wanted to organize my life and building the tool to do it had to happen together.

The full story is in the commit history.
