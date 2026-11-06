# constraints
* Each form needs to be reviewed by a native speaker before examples are written.
* If a form is flagged, the admin updates that row directly in place, preventing orphaned child rows.
* Each example needs to be reviewed by a native speaker before audio is recorded.
* Each recording needs to be reviewed by the admin before getting added to lessons.
* Batch size is fixed at 3 example sentences per form.

# db schema
forms: id, masdar, screeve, subject, object, form, creator, reviewer, status (unassigned, assigned, submitted, approved, flagged), comment, created_at, updated_at
sentences: id, form_id, text, creator, reviewer, status (assigned, submitted, approved, flagged), comment, created_at, updated_at
recordings: id, sentence_id, audio_path, creator, reviewer, status (assigned, submitted, approved, flagged), comment, created_at, updated_at
users: id, username, gender, age_range, role, created_at, updated_at

# workflow
## admin adds forms and bulk assigns
    * Admin inputs forms (masdar, screeve, subject, object, form).
    * Admin views unique masdar + screeve combos and assigns a writer and a recorder via dropdowns.
    * Backend immediately generates all child rows to prevent bottlenecks:
        * Creates 3 sentence rows per form with `creator = writer` and `status = assigned`.
        * Creates corresponding recording rows with `creator = recorder` and `status = assigned`.

## user reviews forms + writes sentences
    * User opens assigned sentence rows where `status = assigned` and parent form status is not flagged.
    * For each sentence assignment detail view:
        * If the form needs review, prompt user to approve or flag the form:
            * `form.reviewer = user`
            * If approved: `form.status = approved`
            * If flagged: `form.status = flagged` and `form.comment = user's comment`
        * Once the form is approved:
            * Prompt user to write 3 short, clear, natural sentences with varied vocabulary.
            * System double-checks that the example contains `form_id.form`.
            * Save text and set sentence `status = submitted`.

## user reviews sentences + records
    * User opens assigned recording rows where `status = assigned` and parent sentence status is not flagged.
    * For each recording assignment detail view:
        * If the sentence is `submitted`, prompt user to review it against quality guidelines (grammar, naturalness, beginner-friendly):
            * `sentence.reviewer = user`
            * If approved: `sentence.status = approved`
            * If flagged: `sentence.status = flagged` and `sentence.comment = user's comment`
        * Once the sentence is approved:
            * Prompt user to record in a quiet place using a good mic.
            * Automatically replay audio and ask user to save or redo.
            * On save: save `audio_path` and set recording `status = submitted`.

## admin reviews recordings
    * Admin opens a queue showing all recordings where `status = submitted`.
    * Admin listens and updates status:
        * If approved: `status = approved`, `reviewer = admin`
        * If flagged: `status = flagged`, `comment = admin's comment`

## admin reviews flags
    * Admin opens a dedicated dashboard showing all forms, sentences, and recordings where `status = flagged` to resolve issues and update rows in place.

# rls & permissions security policies (supabase)

## role-based access control (rbac) overview
* **helper function:** a secure database function checks the user's role from the `users` table matching their authentication id.

## table-level permissions

### forms table
* **admins:** full management access (create, read, update, delete).
* **authenticated users:** can view all forms.
* **writers:** can update the `reviewer`, `status`, and `comment` fields when reviewing assigned forms.

### sentences table
* **authenticated users:** can view all sentences.
* **writers:** can update the `text` and change status to `submitted` on rows where they are the assigned creator.
* **recorders:** can update the `reviewer`, `status` (approved/flagged), and `comment` fields when reviewing assigned sentences.

### recordings table
* **authenticated users:** can view all recordings.
* **recorders:** can upload the `audio_path` and change status to `submitted` on rows where they are the assigned creator.
* **admins:** can review, update status, and add comments/reviewers.

## column-level security safeguards
* database triggers ensure non-admin users cannot modify restricted metadata columns (such as primary keys, foreign keys, or creator IDs) during updates, preventing unauthorized data hijacking.

