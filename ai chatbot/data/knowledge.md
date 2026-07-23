# Avatar AMSA — Help Assistant Knowledge Base

This is the source of truth the help assistant answers from. Keep it accurate: if a
feature is only a prototype stub, say so here so the assistant doesn't promise things
the app can't do yet. Update this file as the app grows.

## What Avatar AMSA is

Avatar AMSA (Final Examination Assistant) is a training tool that helps maritime
students prepare for the Australian Maritime Safety Authority (AMSA) Certificate of
Competency oral examination. It is being built with AMC Search. The web dashboard is
where a student signs in and manages their practice.

## Pages and what each one is for

### Login (login.html)
- Fields: email and password.
- "Forgot password?" link goes to the password reset page.
- There is also a "Continue as guest" demonstration option.
- Status: front-end prototype. It checks the email looks valid and the password is at
  least 6 characters, then shows a success message. It does not yet connect to a real
  account system, so no real credentials are checked yet.

### Register / Create account (register.html)
- Fields: first name, last name, email, student ID, account type (Student or Educator),
  password, and confirm password. You must accept the terms.
- The password must be at least 8 characters. The two password fields must match.
- Status: front-end prototype. On success it shows a confirmation and sends you to the
  login page. Accounts are not yet stored in a database.

### Forgot password (forgot-password.html)
- You enter your email and submit to request a reset.
- Status: front-end prototype. It confirms on screen but does not yet send a real reset
  email, because the email/account backend is not built yet.

### Dashboard (dashboard.html)
The main screen after signing in. It has a left sidebar menu and a main area.

Sidebar menu items:
- Dashboard — the overview/home screen.
- Practice Examination — intended to launch the AI examiner practice session. Status:
  the button is a stub right now; it shows a placeholder message and is waiting to be
  connected to the examiner.
- Performance — intended to show performance breakdowns.
- Study Resources — intended to hold study materials.
- Examination History — intended to list past practice sessions.
- My Profile — the student's profile.
- Settings — app settings.
- Log Out (bottom of the sidebar) — signs out and returns to the login page.

The dashboard overview shows summary tiles: practice sessions completed, average
examination score, total preparation time, and overall examination readiness, plus
recent practice sessions and a progress panel. Status: the numbers currently shown are
sample/placeholder values for the prototype, not real tracked data yet.

## Common questions and how to answer them

- How do I sign in? Go to the login page, enter your email and password, and select
  Log In. If you don't have an account yet, use the "Create account" / register link.
- How do I create an account? Open the register page and fill in your name, email,
  student ID, choose Student or Educator, and set a password of at least 8 characters
  (entered twice). Accept the terms and submit.
- I forgot my password. Use the "Forgot password?" link on the login page and enter your
  email. Note that automated reset emails are not switched on yet in this prototype, so
  for now contact your course administrator if you're locked out.
- How do I start a practice exam? Use the "Practice Examination" item in the dashboard
  sidebar. Be honest that this is not fully wired up yet and is coming.
- How do I log out? Use the Log Out button at the bottom of the dashboard sidebar.
- What is this app for? Preparing for the AMSA Certificate of Competency oral exam.

## Tone and rules for the assistant

- Be friendly, brief, and practical. This is a helper for using the interface, not an
  examiner. Do not run quizzes or ask exam questions.
- Only describe what actually exists per this document. If you don't know, say so and
  suggest contacting the course administrator or AMC Search support, rather than
  inventing steps.
- Never ask for or repeat passwords. If a user pastes a password or key, tell them not
  to share it and do not store it.
