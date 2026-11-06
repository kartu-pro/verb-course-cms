function app() {
    return {
        user: null,
        profile: null,
        currentTab: 'stats',
        mobileMenuOpen: false,
        email: '',
        password: '',
        errorMessage: '',
        loading: false,
        flatWritingTasks: [],
        flatRecordingTasks: [],
        contributors: [],
        uniqueCombos: [],
        adminRecordings: [],
        adminFlags: [],
        stats: { wReady: 0, wBlockedForm: 0, wSubmitted: 0, wApproved: 0, wFlagged: 0, rReady: 0, rWaitingOnPeer: 0, rBlockedSentence: 0, rSubmitted: 0, rApproved: 0, rFlagged: 0 },
        sentenceErrors: {},
        toast: { show: false, message: '', type: 'success' },

        showToast(message, type = 'success') {
            this.toast = { show: true, message, type };
            setTimeout(() => {
                this.toast.show = false;
            }, 3000);
        },

        async init() {
            // Expose showToast globally so separate scripts like recorder.js can trigger toasts
            window.showToast = (msg, type) => this.showToast(msg, type);

            this.loading = true;
            db.auth.onAuthStateChange(async (event, session) => {
                const newUser = session?.user || null;
                if (newUser?.id !== this.user?.id) {
                    this.user = newUser;
                    if (this.user) {
                        await this.fetchProfile();
                        await this.fetchStats();
                        await this.fetchTasks();
                    } else {
                        this.profile = null;
                        this.flatWritingTasks = [];
                        this.flatRecordingTasks = [];
                    }
                }
                this.loading = false;
            });
            const { data: { session } } = await db.auth.getSession();
            if (!session) {
                this.loading = false;
            }
        },

        async fetchProfile() {
            const { data } = await db.from('users').select('*').eq('id', this.user.id).single();
            this.profile = data;
        },

        async login() {
            this.errorMessage = '';
            this.loading = true;
            const { error } = await db.auth.signInWithPassword({ email: this.email, password: this.password });
            this.loading = false;
            if (error) {
                this.errorMessage = error.message;
                this.showToast(error.message, 'error');
            } else {
                this.showToast('Successfully signed in!');
            }
        },

        async logout() {
            await db.auth.signOut();
            this.user = null;
            this.profile = null;
            this.showToast('Signed out successfully');
        },

        async fetchStats() {
            const { data: wData } = await db
                .from('sentences')
                .select(`status, forms (status)`)
                .eq('creator', this.user.id);

            this.stats.wReady = 0;
            this.stats.wBlockedForm = 0;
            this.stats.wSubmitted = 0;
            this.stats.wApproved = 0;
            this.stats.wFlagged = 0;

            (wData || []).forEach(row => {
                const formStatus = row.forms?.status;
                if (row.status === 'assigned') {
                    if (formStatus === 'flagged') {
                        this.stats.wBlockedForm++;
                    } else {
                        this.stats.wReady++;
                    }
                }
                if (row.status === 'submitted') this.stats.wSubmitted++;
                if (row.status === 'approved') this.stats.wApproved++;
                if (row.status === 'flagged') this.stats.wFlagged++;
            });

            const { data: rData } = await db
                .from('recordings')
                .select(`status, sentences (status)`)
                .eq('creator', this.user.id);

            this.stats.rReady = 0;
            this.stats.rWaitingOnPeer = 0;
            this.stats.rBlockedSentence = 0;
            this.stats.rSubmitted = 0;
            this.stats.rApproved = 0;
            this.stats.rFlagged = 0;

            (rData || []).forEach(row => {
                const sentenceStatus = row.sentences?.status;
                
                if (row.status === 'assigned') {
                    if (!sentenceStatus || sentenceStatus === 'assigned') {
                        this.stats.rWaitingOnPeer++;
                    } else if (sentenceStatus === 'flagged') {
                        this.stats.rBlockedSentence++;
                    } else if (sentenceStatus === 'submitted' || sentenceStatus === 'approved') {
                        this.stats.rReady++;
                    }
                }
                if (row.status === 'submitted') this.stats.rSubmitted++;
                if (row.status === 'approved') this.stats.rApproved++;
                if (row.status === 'flagged') this.stats.rFlagged++;
            });
        },

        async fetchTasks() {
            this.loading = true;
            const { data: wData } = await db
                .from('sentences')
                .select(`id, status, form_id, forms (id, masdar, screeve, subject, object, form, status, reviewer, comment)`)
                .eq('creator', this.user.id)
                .eq('status', 'assigned');
            
            const formMap = {};
            (wData || []).forEach(row => {
                const f = row.forms;
                if (!f) return;
                if (!formMap[f.id]) {
                    formMap[f.id] = { formObj: f, sentences: [] };
                }
                formMap[f.id].sentences.push({ id: row.id, form_id: row.form_id });
            });

            this.flatWritingTasks = Object.values(formMap).sort((a, b) => {
                const mComp = a.formObj.masdar.localeCompare(b.formObj.masdar);
                if (mComp !== 0) return mComp;
                const sComp = getScreeveRank(a.formObj.screeve) - getScreeveRank(b.formObj.screeve);
                if (sComp !== 0) return sComp;
                const subjComp = getPronounRank(a.formObj.subject) - getPronounRank(b.formObj.subject);
                if (subjComp !== 0) return subjComp;
                return getPronounRank(a.formObj.object) - getPronounRank(b.formObj.object);
            });

            const { data: rData } = await db
                .from('recordings')
                .select(`id, status, sentence_id, sentences (id, text, status, reviewer, comment, forms (id, masdar, screeve, subject, object, form))`)
                .eq('creator', this.user.id)
                .eq('status', 'assigned');

            const recList = [];
            (rData || []).forEach(row => {
                const s = row.sentences;
                if (!s || !s.forms || s.status === 'assigned' || s.status === 'flagged') return; 
                
                recList.push({
                    id: row.id,
                    status: row.status,
                    sentence: s,
                    form: s.forms
                });
            });

            this.flatRecordingTasks = recList.sort((a, b) => {
                const mComp = a.form.masdar.localeCompare(b.form.masdar);
                if (mComp !== 0) return mComp;
                const sComp = getScreeveRank(a.form.screeve) - getScreeveRank(b.form.screeve);
                if (sComp !== 0) return sComp;
                const subjComp = getPronounRank(a.form.subject) - getPronounRank(b.form.subject);
                if (subjComp !== 0) return subjComp;
                return getPronounRank(a.form.object) - getPronounRank(b.form.object);
            });
            this.loading = false;
        },

        // --- WRITER ACTIONS ---
        async approveForm(formObj) {
            const { error } = await db.from('forms').update({ 
                status: 'approved', 
                reviewer: this.user.id 
            }).eq('id', formObj.id);

            if (error) { 
                this.showToast(error.message, 'error'); 
                return; 
            }
            formObj.status = 'approved';
            this.showToast('Form verified and approved successfully!');
        },

        async submitFlagForm() {
            if (!this.flagComment.trim()) {
                this.showToast('Please enter a comment for revision.', 'error');
                return;
            }
            const formObj = this.activeFormObj;
            
            const { error } = await db.from('forms').update({ 
                status: 'flagged', 
                reviewer: this.user.id, 
                comment: this.flagComment 
            }).eq('id', formObj.id);

            if (error) { 
                this.showToast(error.message, 'error'); 
                return; 
            }
            
            formObj.status = 'flagged';
            this.flagModalOpen = false;
            this.activeFormObj = null;
            this.flagComment = '';
            this.showToast('Form revision request submitted.');
        },

        async submitSentences(item) {
            const formId = item.formObj.id;
            this.sentenceErrors = {};
            const ex1 = (this.exampleInputs[formId + '_0'] || '').trim();
            const ex2 = (this.exampleInputs[formId + '_1'] || '').trim();
            const ex3 = (this.exampleInputs[formId + '_2'] || '').trim();

            if (!ex1 || !ex2 || !ex3) {
                this.showToast('Please fill in all 3 example sentences.', 'error');
                return;
            }

            const targetForm = item.formObj.form;
            const punctuationRegex = /[.!?]$/;
            const inputs = [ex1, ex2, ex3];
            let hasError = false;

            for (let i = 0; i < inputs.length; i++) {
                const s = inputs[i];
                const key = formId + '_' + i;
                if (!s.includes(targetForm)) {
                    this.sentenceErrors[key] = `Sentence must contain target form: "${targetForm}"`;
                    hasError = true;
                } else if (!punctuationRegex.test(s)) {
                    this.sentenceErrors[key] = 'Sentence must end with a punctuation mark (. ! ?).';
                    hasError = true;
                }
            }

            if (hasError) {
                this.showToast('Please correct validation errors in sentences.', 'error');
                return;
            }

            if (!item.sentences || item.sentences.length < 3) {
                this.showToast('Error: Expected 3 sentence task rows for this form.', 'error');
                return;
            }

            for (let i = 0; i < 3; i++) {
                const sentenceRow = item.sentences[i];
                const { error } = await db.from('sentences').update({
                    text: inputs[i],
                    status: 'submitted'
                }).eq('id', sentenceRow.id);

                if (error) {
                    this.showToast(`Error saving sentence ${i + 1}: ${error.message}`, 'error');
                    return;
                }
            }

            this.showToast('All 3 example sentences submitted successfully!');
            await this.fetchTasks();
            await this.fetchStats();
        },

        // --- RECORDER ACTIONS ---
        async approveSentence(recItem) {
            const { error } = await db.from('sentences').update({ status: 'approved', reviewer: this.user.id }).eq('id', recItem.sentence.id);
            if (error) { 
                this.showToast(error.message, 'error'); 
                return; 
            }
            recItem.sentence.status = 'approved';
            this.showToast('Sentence approved successfully!');
        },

        async submitRecFlag() {
            if (!this.recFlagComment.trim()) {
                this.showToast('Please enter a comment for revision.', 'error');
                return;
            }
            const recItem = this.activeRecObj;

            const { error } = await db.from('sentences').update({ 
                status: 'flagged', 
                reviewer: this.user.id, 
                comment: this.recFlagComment 
            }).eq('id', recItem.sentence.id);

            if (error) { 
                this.showToast(error.message, 'error'); 
                return; 
            }

            recItem.sentence.status = 'flagged';
            this.recFlagModalOpen = false;
            this.activeRecObj = null;
            this.recFlagComment = '';
            this.showToast('Sentence revision request submitted.');
        },

        // --- ADMIN ACTIONS ---
        async fetchAdminData() {
            const { data: uData } = await db.from('users').select('*');
            this.contributors = uData || [];

            const { data: forms, error: fError } = await db.from('forms').select('id, masdar, screeve').eq('status', 'unassigned');
            if (fError) { 
                this.showToast(fError.message, 'error'); 
                return; 
            }

            const comboMap = {};
            (forms || []).forEach(f => {
                const key = `${f.masdar}___${f.screeve}`;
                if (!comboMap[key]) {
                    comboMap[key] = {
                        key: key,
                        masdar: f.masdar,
                        screeve: f.screeve,
                        formIds: [],
                        formCount: 0,
                        writerId: '',
                        recorderId: ''
                    };
                }
                comboMap[key].formIds.push(f.id);
                comboMap[key].formCount++;
            });

            this.uniqueCombos = Object.values(comboMap);
        },

        async assignCombo(combo) {
            if (!combo.writerId || !combo.recorderId) {
                this.showToast('Please select both a writer and a recorder for this combination.', 'error');
                return;
            }

            for (const formId of combo.formIds) {
                await db.from('forms').update({ status: 'assigned' }).eq('id', formId);

                for (let i = 0; i < 3; i++) {
                    const { data: sent } = await db.from('sentences').insert({
                        form_id: formId,
                        creator: combo.writerId,
                        status: 'assigned'
                    }).select('id').single();

                    if (sent) {
                        await db.from('recordings').insert({
                            sentence_id: sent.id,
                            creator: combo.recorderId,
                            status: 'assigned'
                        });
                    }
                }
            }

            this.showToast(`Successfully assigned tasks for ${combo.masdar} (${combo.screeve})!`);
            await this.fetchAdminData();
        },

        async fetchAdminRecordings() {
            const { data } = await db
                .from('recordings')
                .select(`id, audio_path, sentences (id, text, forms (masdar, screeve))`)
                .eq('status', 'submitted');
            this.adminRecordings = data || [];
        },

        supabaseStorageUrl(path) {
            const { data } = db.storage.from('audio-bucket').getPublicUrl(path);
            return data.publicUrl;
        },

        async adminApproveRecording(id) {
            await db.from('recordings').update({ status: 'approved', reviewer: this.user.id }).eq('id', id);
            this.showToast('Recording approved successfully!');
            this.fetchAdminRecordings();
        },

        async adminFlagRecording(id) {
            await db.from('recordings').update({ status: 'flagged', reviewer: this.user.id }).eq('id', id);
            this.showToast('Recording flagged for revision.');
            this.fetchAdminRecordings();
        },

        async fetchAdminFlags() {
            const { data: fForms } = await db.from('forms').select('id, masdar, screeve, comment').eq('status', 'flagged');
            const { data: fSents } = await db.from('sentences').select('id, text, comment').eq('status', 'flagged');
            const { data: fRecs } = await db.from('recordings').select('id, audio_path, comment').eq('status', 'flagged');

            this.adminFlags = [
                ...(fForms || []).map(x => ({ id: x.id, type: 'Form Flag', detail: `${x.masdar} (${x.screeve})`, comment: x.comment })),
                ...(fSents || []).map(x => ({ id: x.id, type: 'Sentence Flag', detail: x.text, comment: x.comment })),
                ...(fRecs || []).map(x => ({ id: x.id, type: 'Recording Flag', detail: x.audio_path, comment: x.comment }))
            ];
        }
    }
}