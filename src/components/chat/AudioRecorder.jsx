import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Trash2, Send, Loader2 } from 'lucide-react';

export default function AudioRecorder({ onRecordingComplete, onCancel }) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    startRecording();
    return () => {
      stopTimer();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(100);
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access error:', err);
      alert('Microphone access is required to record voice notes. Please allow microphone permissions.');
      if (onCancel) onCancel();
    }
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleCancel = () => {
    stopTimer();
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    if (onCancel) onCancel();
  };

  const handleSend = async () => {
    if (!mediaRecorderRef.current || isUploading) return;
    stopTimer();
    setIsUploading(true);

    mediaRecorderRef.current.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const file = new File([audioBlob], `voice-note-${Date.now()}.webm`, { type: 'audio/webm' });

      // Clean up stream tracks
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());

      // Upload to server
      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });

        if (!res.ok) {
          throw new Error('Audio upload failed');
        }

        const data = await res.json();
        onRecordingComplete(data);
      } catch (err) {
        console.error('Upload error:', err);
        alert('Failed to send audio recording. Please try again.');
        if (onCancel) onCancel();
      } finally {
        setIsUploading(false);
      }
    };

    mediaRecorderRef.current.stop();
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      width: '100%',
      backgroundColor: 'var(--bg-card)',
      padding: '8px 16px',
      borderRadius: '24px',
      border: '1px solid var(--border-color)',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      {/* Trash / Cancel */}
      <button
        type="button"
        onClick={handleCancel}
        disabled={isUploading}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--danger)',
          cursor: 'pointer',
          padding: '6px',
          display: 'flex',
          alignItems: 'center'
        }}
        title="Discard recording"
      >
        <Trash2 size={20} />
      </button>

      {/* Recording indicator dot and timer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
        <div style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          backgroundColor: 'var(--danger)',
          animation: 'pulseDot 1s infinite'
        }} />
        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', minWidth: '40px' }}>
          {formatTime(recordingTime)}
        </span>
        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          {isUploading ? 'Sending voice note...' : 'Recording voice note...'}
        </span>
      </div>

      {/* Send Button */}
      <button
        type="button"
        onClick={handleSend}
        disabled={isUploading}
        style={{
          background: 'var(--wa-green)',
          color: '#ffffff',
          border: 'none',
          borderRadius: '50%',
          width: '38px',
          height: '38px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: isUploading ? 'not-allowed' : 'pointer',
          boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
          transition: 'transform 0.1s'
        }}
        title="Send voice note"
      >
        {isUploading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={18} />}
      </button>
    </div>
  );
}
