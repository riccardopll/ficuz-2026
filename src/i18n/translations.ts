export const translations = {
  title: "Classifica Ficuz 2026",
  name: "Nome",
  ficuzPoints: "Punti Ficuz",
  unit: "PF",
  admin: "Admin",
  adminPasswordTitle: "Accesso admin",
  adminPasswordLabel: "Password",
  adminPasswordPlaceholder: "Inserisci la password",
  adminPasswordSubmit: "Abilita controlli",
  adminPasswordInvalid: "Password non valida",
  adminLogout: "Esci",
  close: "Chiudi",
  periods: "Periodo della classifica",
  seasons: "Stagioni della classifica",
  season: "Stagione",
  seasonStatus: {
    upcoming: "In arrivo",
    active: "In corso",
    archived: "Archiviata",
  },
  seasonArchivedNotice: "Classifica finale, in sola lettura",
  adjustPoints: "Modifica punti",
  noPlayers: "Nessun giocatore",
  pointChangeLabels: {
    [-0.5]: "Diminuisci di mezzo punto",
    [0.5]: "Aumenta di mezzo punto",
  },
  rulesTitle: "Regolamento",
  rules: [
    {
      points: 0.5,
      description: "Per chi arriva in ritardo di più di 30 minuti",
    },
    {
      points: 1,
      description: "Per chi arriva in ritardo di più di 1 ora",
    },
    {
      points: 1,
      description: "Per ogni allenamento saltato con meno di 4 ore di preavviso",
      notes: ["La validità della motivazione è a discrezione del gruppo"],
    },
    {
      points: 1,
      description: "Per chi si allena meno di 3 volte a settimana",
      notes: [
        "Si è esenti da questa regola se ci si è allenati almeno 2 volte nella settimana e si è andati a correre almeno due volte",
        "Gli allenamenti da soli richiedono una foto postata nel gruppo per essere contati nel minimo settimanale",
      ],
    },
    {
      points: 2,
      description: "Per chi mente sulla propria frequenza",
    },
  ],
  months: ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"],
};
