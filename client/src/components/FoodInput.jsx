import { useState, useRef, useCallback } from 'react';
import { Mic, MicOff, Camera, Send, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { analyzeFood } from '../api';

export default function FoodInput({ onResult, onError }) {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const fileInputRef = useRef(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], 'recording.webm', { type: 'audio/webm' });
        setAudioFile(file);
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      onError?.('לא ניתן לגשת למיקרופון');
    }
  }, [onError]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, []);

  const handleImage = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreview(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();
      
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      
      stream.getTracks().forEach(t => t.stop());
      
      canvas.toBlob((blob) => {
        const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
        setImageFile(file);
        setImagePreview(canvas.toDataURL('image/jpeg'));
      }, 'image/jpeg', 0.8);
    } catch {
      fileInputRef.current?.click();
    }
  };

  const clearImage = () => {
    setImagePreview(null);
    setImageFile(null);
  };

  const clearAudio = () => {
    setAudioFile(null);
  };

  const handleSubmit = async () => {
    if (!text.trim() && !imageFile && !audioFile) return;
    
    setLoading(true);
    try {
      const file = imageFile || audioFile;
      const result = await analyzeFood(text.trim() || null, file);
      onResult?.(result);
      setText('');
      clearImage();
      clearAudio();
    } catch (err) {
      onError?.(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="food-input">
      <div className="input-main">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="מה אכלת? למשל: 2 פרוסות לחם עם גבינה צהובה..."
          rows={2}
          disabled={loading}
        />
        <div className="input-actions">
          <button
            className={`icon-btn ${isRecording ? 'recording' : ''}`}
            onClick={isRecording ? stopRecording : startRecording}
            title={isRecording ? 'הפסק הקלטה' : 'הקלט קול'}
            disabled={loading}
          >
            {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
          <button
            className="icon-btn"
            onClick={handleCapture}
            title="צלם תמונה"
            disabled={loading}
          >
            <Camera size={20} />
          </button>
          <button
            className="icon-btn"
            onClick={() => fileInputRef.current?.click()}
            title="העלה תמונה"
            disabled={loading}
          >
            <ImageIcon size={20} />
          </button>
          <button
            className="submit-btn"
            onClick={handleSubmit}
            disabled={loading || (!text.trim() && !imageFile && !audioFile)}
            title="שלח"
          >
            {loading ? <Loader2 size={20} className="spin" /> : <Send size={20} />}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImage}
          style={{ display: 'none' }}
        />
      </div>
      
      {(imagePreview || audioFile) && (
        <div className="input-preview">
          {imagePreview && (
            <div className="preview-item">
              <img src={imagePreview} alt="preview" />
              <button className="remove-btn" onClick={clearImage}><X size={14} /></button>
            </div>
          )}
          {audioFile && (
            <div className="preview-item audio-preview">
              <Mic size={16} />
              <span>הקלטה מוכנה</span>
              <button className="remove-btn" onClick={clearAudio}><X size={14} /></button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
