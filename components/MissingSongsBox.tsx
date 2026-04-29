export default function MissingSongsBox() {
  return (
    <section className="missing-song-box">
      <div className="missing-song-icon">✉</div>
      <div>
        <h3>Song fehlt?</h3>
        <p>Vorschlag per Mail oder Instagram-Nachricht senden.</p>
        <div className="missing-song-actions">
          <a href="mailto:voting@knallhart-serviert.de?subject=Songvorschlag%20Publikums-Voting" className="button primary small">
            voting@knallhart-serviert.de
          </a>
          <a href="https://www.instagram.com/knallhart_serviert" target="_blank" rel="noreferrer" className="button secondary small">
            Instagram-Nachricht
          </a>
        </div>
      </div>
    </section>
  );
}
