# constraints
each form needs to be reviewed by native before examples written
each example needs to be reviewed by native before examples recorded
each recording needs to be reviewed by admin before getting added to lessons

# db schema
forms: id, masdar, screeve, subject, object, form, creator, reviwer, status (assigned, created, approved, flagged), comment
sentences: id, form_id, text, creator, reviewer, status (assigned, created, approved, flagged), comment
recordings: id, sentence_id, audio_path, creator, reviewer, status (assigned, created, approved, flagged), comment
users: id, username, gender, age_range, role

# workflow
## admin adds form
    masdar, screeve, subject, object, form
    use admin user_id for creator, status = created

## admin assigns writer for forms, and recorder for examples
    admin sees list of unique masdar + screeve combos from forms table
    assigns masdar/screeve combo to one user as writer, one user as recorder (using dropdowns)
    backend creates 3 rows in sentences table for each form_id in masdar+screeve combo
    for each row created in sentences, create related row in recordings
    eg admin assigns ყოფნა+present combo
        writer = user1
        recorder = user2
        for each form with this masdar and screeve, create 3 sentence rows with creator = user1 and status = assigned
        for each sentence row, create corresponding recording row with sentence_id = related sentence.id, creator = user2, status = assigned


## user reviews forms + writes sentences
    opens page that shows sentences rows where creator = user, status = assigned, and form_id.status != flagged
    for sentence assignment detail view
        if form_id.status = created, prompt user to approve/flag form;
            form.reviewer = user
            if approved, set form_id.status = approved
            if flagged, set form_id.status = flagged and form_id.comment = user's comment
        if form_id.status = approved (or just approved)
            prompt user to write easy, short, clear, natural, sentences with varied vocab
            let user write 3 examples
            double check example contains form_id.form
            then save example to text and set status to created

## user reviews sentences + records
    opens page that shows recordings rows where creator = user, status = assigned, and sentence_id.status != flagged
    for recording assignment detail view
        if sentence_id.status = created, prompt user to approve/flag sentence
            show some prompt here that highlights what they should look for (grammar mistakes, natural sounding, clear, suitable for beginning learners)
            sentence.reviewer = user
            if approved, set sentence_id.status = approved
            if flagged, set sentence_id.status = flagged and sentence_id.comment = user's comment
        if sentence_id.status = approved (or just approved)
            prompt user to record in quiet place, good mic, 
            let user record sentence
            automatically replay and ask user to save or redo
            on save save audio_path and set status = created

## admin reviews recordings
    opens page that shows recordings where status = created
    admin listens and approves/flags
        if approves, status = approved, reviewer = admin user
        if flags, status = flagged, comment = admin's comment

## admin reviews flags
    opens page that shows all forms, sentences, and recordings where status = flagged
