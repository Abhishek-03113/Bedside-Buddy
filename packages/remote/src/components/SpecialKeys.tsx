import type { WsClient } from '../ws-client';
import type { RemoteKey } from '@coosy/shared';

interface SpecialKeysProps {
  client: WsClient;
  onToast: (toast: { message: string; ok: boolean }) => void;
}

const KEYS: Array<{ label: string; key: RemoteKey }> = [
  { label: 'Esc', key: 'Escape' },
  { label: 'Tab', key: 'Tab' },
  { label: '←', key: 'ArrowLeft' },
  { label: '↑', key: 'ArrowUp' },
  { label: '↓', key: 'ArrowDown' },
  { label: '→', key: 'ArrowRight' },
  { label: '⌫', key: 'Backspace' },
  { label: 'Enter', key: 'Enter' },
];

export function SpecialKeys({ client, onToast }: SpecialKeysProps) {
  const handlePress = async (key: RemoteKey) => {
    try {
      await client.sendInput({ type: 'key-down', key }, { awaitResult: true });
      await client.sendInput({ type: 'key-up', key }, { awaitResult: true });
    } catch (err: any) {
      onToast({ message: err.message || 'Key send failed', ok: false });
    }
  };

  return (
    <div className="special-keys">
      {KEYS.map((k) => (
        <button
          key={k.key}
          className="special-keys__btn"
          onClick={() => handlePress(k.key)}
        >
          {k.label}
        </button>
      ))}
    </div>
  );
}
