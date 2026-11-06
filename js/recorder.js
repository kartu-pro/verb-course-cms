function audioRecorder(recItem) {
    return {
        recording: false,
        mediaRecorder: null,
        mediaStream: null,
        audioChunks: [],
        audioBlob: null,
        audioUrl: null,
        recordingTime: 0,
        timerInterval: null,
        hasReplayed: false,

        async startRecording() {
            this.audioChunks = [];
            this.recordingTime = 0;
            this.hasReplayed = false;
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                window.showToast('Microphone access is not supported in this browser or requires a secure context (HTTPS / localhost).', 'error');
                return;
            }
            try {
                this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                this.mediaRecorder = new MediaRecorder(this.mediaStream);
                this.mediaRecorder.ondataavailable = e => this.audioChunks.push(e.data);
                this.mediaRecorder.onstop = () => {
                    this.audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                    this.audioUrl = URL.createObjectURL(this.audioBlob);
                };
                this.mediaRecorder.start();
                this.recording = true;

                this.timerInterval = setInterval(() => {
                    this.recordingTime++;
                }, 1000);
            } catch (err) {
                window.showToast('Could not access microphone. Please check permissions. Error: ' + err.message, 'error');
            }
        },

        stopRecording() {
            if (this.mediaRecorder && this.recording) {
                this.mediaRecorder.stop();
                if (this.mediaStream) {
                    this.mediaStream.getTracks().forEach(track => track.stop());
                }
                this.recording = false;
                clearInterval(this.timerInterval);
            }
        },

        playAudio() {
            if (this.$refs.audioPlayer) {
                this.$refs.audioPlayer.play();
            }
            this.hasReplayed = true;
        },

        resetRecording() {
            this.audioBlob = null;
            this.audioUrl = null;
            this.recordingTime = 0;
            this.hasReplayed = false;
        },

        formatTime(seconds) {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        },

        async uploadAndComplete(recItem) {
            if (!this.audioBlob) {
                window.showToast('No audio recorded.', 'error');
                return;
            }
            const fileName = `${recItem.id}-${Date.now()}.webm`;
            const { data, error } = await window.supabaseClient.storage.from('audio-bucket').upload(fileName, this.audioBlob);
            if (error) { 
                window.showToast(error.message, 'error'); 
                return; 
            }

            const { error: updateErr } = await window.supabaseClient.from('recordings').update({
                audio_path: data.path,
                status: 'submitted'
            }).eq('id', recItem.id);

            if (updateErr) { 
                window.showToast(updateErr.message, 'error'); 
                return; 
            }

            window.showToast('Audio uploaded and submitted successfully!');
            setTimeout(() => {
                window.location.reload();
            }, 1200);
        }
    }
}
