# Dormir en van non self-contained en Nouvelle-Zélande

Carte interactive (Leaflet) des endroits où dormir avec un van **non certifié self-contained** :

- règles de freedom camping pour les 67 districts (rouge : aucun site municipal ; orange : quelques sites désignés) ;
- sites désignés pour les non-SC, gratuits (vert) ou payants / sur don (bleu), avec conditions, lien Google Maps et source officielle ;
- campings du DOC (données ouvertes du DOC, chargées en direct), avec catégorie, prix indicatif, lien Google Maps et page DOC ;
- campings gérés par un conseil (OpenStreetMap via Overpass, chargés en direct), avec lien Google Maps et site internet quand il existe ;
- recherche par nom de site.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Page |
| `style.css` | Mise en forme |
| `app.js` | Logique de la carte |
| `data.js` | Règles par district (`D`), sites non-SC (`P`), sources (`S`), requêtes Google Maps (`GQ`) |
| `ta.js` | Limites des districts (territorial authorities) |
| `leaflet.js`, `leaflet.css` | Leaflet 1.9, en local |

## Mettre en ligne sur GitHub Pages

1. Créer un dépôt public, par exemple `nz-van-map`.
2. Y déposer tous les fichiers à la racine (glisser-déposer dans l’interface GitHub, ou `git push`).
3. Dans le dépôt : **Settings → Pages → Build and deployment → Source : Deploy from a branch**, branche `main`, dossier `/ (root)`.
4. La carte est en ligne après une minute environ à l’adresse `https://<utilisateur>.github.io/nz-van-map/`.

Pour tester en local, un double-clic sur `index.html` suffit. Dans ce cas, le fond « Plan OpenStreetMap » est bloqué par les serveurs d’OSM (ils exigent une page hébergée) : la carte démarre alors sur « Plan Esri ». Une fois en ligne sur GitHub Pages, elle démarre sur le plan OpenStreetMap.

## Mettre à jour les données

- **Ajouter un site non-SC** : ajouter une ligne dans `P` de `data.js` :
  `[lat, lng, 'ns' ou 'np', 'Nom', 'Conditions', 'cléSource', 'Prix (optionnel)']`.
- **Changer la règle d’un district** : modifier l’entrée correspondante dans `D` (`'strict'`, `'some'` ou `'def'`).
- Les campings du DOC et les campings municipaux OSM se mettent à jour seuls.

## Sources et licences

- Règles et sites : sites des conseils, du DOC, de LINZ et du MBIE (liens dans la carte, rubrique Sources). Données réunies le 25 novembre 2026 ; les règlements changent, le panneau sur place prime toujours.
- Campings du DOC : Department of Conservation, licence CC BY 4.0.
- Campings municipaux : © contributeurs OpenStreetMap, licence ODbL. Fonds de carte : OpenStreetMap, Esri World Street Map, World Topo Map et World Imagery.
- Limites des districts : Stats NZ.
