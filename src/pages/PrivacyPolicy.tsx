import { Link } from "react-router-dom";

const updatedAt = "27.10.2026";

export default function PrivacyPolicy() {
  return (
    <div className="legal-page">
      <div className="legal-card card">
        <p className="eyebrow">Rechtliches</p>
        <h1>Datenschutzerklärung</h1>
        <p className="lede">Stand: {updatedAt}</p>

        <section>
          <h2>1. Verantwortliche Stelle</h2>
          <p>
            GentleLife ist ein privates Projekt von Berk-Can Atesoglu und wird nur für den persönlichen
            Gebrauch betrieben. Kontakt: <a href="mailto:berkcan@gentlegroup.de">berkcan@gentlegroup.de</a>.
          </p>
        </section>

        <section>
          <h2>2. Welche Daten verarbeitet werden</h2>
          <p>
            In GentleLife werden nur die Daten verarbeitet, die du selbst einträgst (z. B. Termine,
            Dokument-Metadaten, Finanzpositionen, Aufgaben und Familiendaten).
          </p>
        </section>

        <section>
          <h2>3. Zweck der Verarbeitung</h2>
          <p>
            Die Verarbeitung erfolgt zur Organisation persönlicher Fristen, Aufgaben, Dokumente und Planungen
            innerhalb der App.
          </p>
        </section>

        <section>
          <h2>4. Anmeldung mit Google</h2>
          <p>
            Für die Anmeldung kann Google OAuth verwendet werden. Dabei werden nur die für die Authentifizierung
            notwendigen Informationen genutzt.
          </p>
        </section>

        <section>
          <h2>5. Speicherdauer</h2>
          <p>
            Daten bleiben gespeichert, bis du sie in der App löschst oder deren Löschung beim Betreiber anforderst.
            Die App läuft bei Vercel (Oberfläche) und MonsterASP (Server und Datenbank, EU).
          </p>
        </section>

        <section>
          <h2>6. Betroffenenrechte</h2>
          <p>
            Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung,
            Datenübertragbarkeit und Beschwerde bei einer Aufsichtsbehörde.
          </p>
        </section>

        <section>
          <h2>7. Kontakt</h2>
          <p>
            Datenschutzanfragen bitte an <a href="mailto:berkcan@gentlegroup.de">berkcan@gentlegroup.de</a>.
          </p>
        </section>

        <div className="legal-links">
          <Link to="/terms">Zu den Nutzungsbedingungen</Link>
          <Link to="/">Zur App</Link>
        </div>
      </div>
    </div>
  );
}
