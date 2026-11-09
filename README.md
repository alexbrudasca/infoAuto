# InfoAuto – prima versiune

Aplicație web instalabilă (PWA), cu interfață în limba română, pentru urmărirea ITP, RCA și rovinietei. Proiectul este pregătit pentru autentificare și sincronizare prin Supabase.

## Ce include
- cont separat pentru fiecare utilizator (email + parolă);
- fiecare cont vede doar mașinile și documentele proprii;
- adăugare mașini și înregistrări pentru ITP, RCA și rovinietă;
- cost, dată emitere, dată expirare și notițe;
- evidențiere expirate / expiră în următoarele 30 de zile;
- PWA instalabilă pe iPhone și Android.

## Configurare necesară pentru sincronizarea celor 3 utilizatori
1. Creează un proiect gratuit la https://supabase.com/.
2. În proiect, deschide SQL Editor și rulează integral `supabase_schema.sql`.
3. În Project Settings > API, copiază Project URL și `anon` / publishable key.
4. Deschide `config.js` și înlocuiește valorile `PASTE_...`.
5. Publică fișierele pe un hosting static HTTPS (de exemplu Cloudflare Pages sau Netlify). Pentru o utilizare reală, nu deschide doar fișierul local.
6. Trimite linkul HTTPS celor doi prieteni; fiecare își creează cont separat.

## Instalare pe iPhone
Deschide linkul în Safari → butonul Share → Add to Home Screen → Add.

## Notificări – limitarea primei versiuni
Interfața verifică expirările și poate afișa notificări locale când aplicația este deschisă și notificările au fost permise. Notificările push reale, care ajung și când aplicația este închisă, necesită configurarea unui serviciu push și a unei funcții programate pe server. Acest lucru nu este încă inclus în acest prototip. Pe iOS, notificările web necesită instalarea aplicației pe ecranul principal și acordarea permisiunii.

## Important
- Proiectul nu verifică automat bazele de date oficiale și nu reînnoiește documente.
- Introduceți manual datele de pe documente.
- Folosiți doar cheia publică Supabase `anon` / publishable în `config.js`. Nu folosiți niciodată `service_role`.
- Pentru conturile celor trei prieteni, fiecare utilizator trebuie să se înregistreze cu propriul email.
