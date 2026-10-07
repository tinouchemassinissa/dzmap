# DZMap data sources and licensing

## 2026 administrative structure

DZMap follows **Law No. 26-06 of 4 April 2026**, published in the Algerian Official Journal No. 25 on 5 April 2026. The law establishes a territorial organization of **69 wilayas**. Ministry of Interior material describes the resulting national structure as **69 wilayas and 1,541 communes** and the transition of responsibilities to the newly created wilayas through 31 December 2026.

Primary legal reference:

- Journal Officiel de la République Algérienne, No. 25, 5 April 2026:
  https://www.joradp.dz/FTP/jo-francais/2026/F2026025.pdf

Government reference:

- Ministry of Interior, territorial-organization presentation:
  https://interieur.gov.dz/2025/12/18/le-ministre-de-linterieur-des-collectivites-locales-et-des-transports-presente-le-projet-de-loi-relatif-a-lorganisation-territoriale-du-pays-devant-la-commission-competente-du-conse/

## Wilaya boundary polygons

The 69-wilaya geometry in `public/algeria.json` is derived from the GeoAlgeria 69-wilaya boundary dataset, whose polygons are derived from OpenStreetMap administrative relations and distributed under the Open Database License (ODbL) 1.0.

Attribution:

**© OpenStreetMap contributors**

- https://www.openstreetmap.org/copyright
- https://opendatacommons.org/licenses/odbl/1-0/
- GeoAlgeria source repository: https://github.com/yasserstudio/geoalgeria

GeoAlgeria's metadata records a 69-feature boundary dataset and documents corrections against 2026 commune membership. DZMap preserves the required attribution and treats the legal/gazette material—not OpenStreetMap—as the authority for the official count and administrative reform.

## Learning regions

The broad North / South / East / West / Central groupings in DZMap are **learning categories used by the application**. They are not presented as an official Algerian administrative tier.

## Legacy facts

Older descriptive cultural/geographic facts retained from the original DZMap dataset are marked internally as `legacy-local-fact`. The 11 wilayas created in 2026 receive neutral reform summaries grounded in the official 2026 structure. A future content-audit pass should replace or individually source legacy facts before presenting them as authoritative claims.
