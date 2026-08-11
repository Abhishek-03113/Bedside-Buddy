import { SourceTile } from "../components/SourceTile";
import { ContinueCard } from "../components/ContinueCard";

const PLACEHOLDER_SOURCES = [
  { id: "netflix", displayName: "Netflix", icon: { src: "netflix", alt: "Netflix" } },
];

interface HomeScreenProps {
  onSelectSource: (id: string) => void;
}

export function HomeScreen({ onSelectSource }: HomeScreenProps) {
  return (
    <main className="home">
      <header className="home__header">
        <h1 className="home__brand">CoOSy</h1>
        <p className="home__tagline">Pick a source. Control from your phone.</p>
      </header>

      {/* Continue Watching only renders when a source reports the capability */}
      <ContinueCard items={[]} />

      <section className="home__sources" aria-label="Sources">
        {PLACEHOLDER_SOURCES.map((source) => (
          <SourceTile
            key={source.id}
            id={source.id}
            displayName={source.displayName}
            icon={source.icon}
            onSelect={() => onSelectSource(source.id)}
          />
        ))}
      </section>
    </main>
  );
}
