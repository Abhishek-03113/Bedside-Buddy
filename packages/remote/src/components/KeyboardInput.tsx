import { useState, useRef, useEffect, ChangeEvent, FormEvent } from 'react';
import type { WsClient } from '../ws-client';

interface KeyboardInputProps {
  client: WsClient;
  status: 'connected' | 'disconnected' | 'connecting' | string;
  onToast: (toast: { message: string; ok: boolean }) => void;
}

export function KeyboardInput({ client, status, onToast }: KeyboardInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevValue = useRef('');

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    } else {
      prevValue.current = '';
    }
  }, [isOpen]);

  const handleChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const prev = prevValue.current;
    
    try {
      if (val.length < prev.length) {
        const diff = prev.length - val.length;
        for (let i = 0; i < diff; i++) {
          await client.sendInput({ type: 'key-down', key: 'Backspace' }, { awaitResult: true });
          await client.sendInput({ type: 'key-up', key: 'Backspace' }, { awaitResult: true });
        }
      } else if (val.length > prev.length) {
        const newChars = val.slice(prev.length);
        await client.sendInput({ type: 'text-input', text: newChars }, { awaitResult: true });
      }
    } catch (err: any) {
      onToast({ message: 'Input failed', ok: false });
    }
    
    prevValue.current = val;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await client.sendInput({ type: 'key-down', key: 'Enter' }, { awaitResult: true });
      await client.sendInput({ type: 'key-up', key: 'Enter' }, { awaitResult: true });
      if (inputRef.current) {
        inputRef.current.value = '';
        prevValue.current = '';
      }
    } catch (err: any) {
      onToast({ message: 'Submit failed', ok: false });
    }
  };

  return (
    <div className="keyboard-input">
      <button 
        className="keyboard-input__toggle remote__chip" 
        onClick={() => setIsOpen(!isOpen)}
        disabled={status !== 'connected'}
      >
        Keyboard
      </button>
      {isOpen && (
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            className="keyboard-input__field"
            type="text"
            onChange={handleChange}
            onBlur={() => setIsOpen(false)}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
          />
        </form>
      )}
    </div>
  );
}
