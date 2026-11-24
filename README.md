# MindCare backend lab

MindCare is a local JSON API for user accounts and a counselor directory. It uses Express, Prisma, SQLite, Vitest, and Supertest.

## Setup

Use Node.js 24 or 26 and npm. In a fresh checkout, run:

```sh
npm ci
cp .env.example .env
openssl rand -hex 32
```

Put the generated value in `JWT_SECRET` in `.env`. The default development database is `prisma/dev.db`.

```sh
npm run db:generate
npm run db:setup
npm run dev
```

The API runs at `http://localhost:3000`. For a browser-readable response, open `http://localhost:3000/api/counselor-profiles`.

## API

Use JSON request bodies and add `Authorization: Bearer <token>` on protected routes. Login returns the token in `token`, valid for one hour.

| Method and path | Access | Request or result |
| --- | --- | --- |
| `POST /api/auth/register` | Public | Send `name`, `email`, `password` and optional `role` (`CLIENT` by default or `COUNSELOR`). Returns `201`. |
| `POST /api/auth/login` | Public | Send `email` and `password`. Returns `200` and a token. |
| `GET /api/users/me` | Signed-in user | Returns the user's account, `200`. |
| `PATCH /api/users/me` | Signed-in user | Send `name`, `password`, or both. Returns `200`. |
| `DELETE /api/users/me` | Signed-in user | Deletes the account and its profile, if present. Returns `204`. |
| `POST /api/counselor-profiles` | Signed-in counselor | Send `bio`, `specialty`, and `yearsOfExperience`. Returns `201`. |
| `GET /api/counselor-profiles` | Public | Returns the directory, `200`. Use `?search=` to filter by counselor name or specialty. |
| `GET /api/counselor-profiles/:id` | Public | Returns one profile, `200`. Use the profile's `id` from the create or directory response. |
| `PATCH /api/counselor-profiles/:id` | Profile owner | Send one or more profile fields. Returns `200`. |
| `DELETE /api/counselor-profiles/:id` | Profile owner | Deletes the profile, `204`. |

`PATCH` and `DELETE` also accept `/api/counselor-profiles/me` for the signed-in counselor's own profile. The API gets the owner from the token and returns only the counselor's name from the linked account in public profile reads.

### Example requests

Register and log in with a fictional counselor account:

```sh
BASE_URL=http://localhost:3000
curl -sS -X POST "$BASE_URL/api/auth/register" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Demo Counselor","email":"lab-counselor@example.test","password":"DemoPassword123!","role":"COUNSELOR"}'

curl -sS -X POST "$BASE_URL/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"lab-counselor@example.test","password":"DemoPassword123!"}'
```

Copy the login response's `token` into `TOKEN` below:

```sh
TOKEN='<token from login>'
curl -sS -X POST "$BASE_URL/api/counselor-profiles" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"bio":"Fictional profile for the MindCare lab.","specialty":"Stress management","yearsOfExperience":5}'

curl -sS "$BASE_URL/api/counselor-profiles?search=Stress"
```

To read, edit, or delete that profile by ID, copy the create response's `profile.id`:

```sh
PROFILE_ID='<profile.id from create>'
curl -sS "$BASE_URL/api/counselor-profiles/$PROFILE_ID"

curl -sS -X PATCH "$BASE_URL/api/counselor-profiles/$PROFILE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"specialty":"Sleep support"}'

curl -i -X DELETE "$BASE_URL/api/counselor-profiles/$PROFILE_ID" \
  -H "Authorization: Bearer $TOKEN"
```

## Automated demonstration

```sh
npm test
```

This command demonstrates both create → read → update → delete flows. Supertest sends requests through Express. The suite applies the checked-in migrations to a temporary SQLite database, uses Prisma for real data operations, and resets that temporary database between sequential tests.

| Feature | Test case | Expected result |
| --- | --- | --- |
| Accounts | Register valid details | `201`; email normalized and password stored as a hash |
| Accounts | Register an existing email or invalid input | `409` for a duplicate, `400` for invalid input |
| Accounts | Log in with valid or incorrect credentials | `200` with a one-hour JWT, or `401` |
| Accounts | Access a protected route without a valid token | `401` |
| Accounts | Read or change one's own account | `200`; name and password can be updated |
| Accounts | Submit disallowed fields on update | `400`; role, email, and ownership stay intact |
| Accounts | Read account responses | Passwords and hashes are absent |
| Accounts | Delete one's account | `204`; the old token gets `401` |
| Profiles | Create one's own profile | `201`; owner comes from the token |
| Profiles | Create a second profile or submit invalid fields | `409` for a duplicate, `400` for invalid fields |
| Profiles | Create without login or as a client | `401` without login, `403` for a client |
| Profiles | List and search by name or specialty | `200` with matching profiles |
| Profiles | Read one profile by ID | `200` with the profile and counselor name |
| Profiles | Update one's own profile | `200` with the updated fields |
| Profiles | Target another counselor's profile for update or deletion | `403`; the other profile stays intact |
| Profiles | Delete one's own profile | `204`; reading it by ID afterward returns `404` |
| Profiles | Delete the account that owns a profile | `204` for account deletion; the profile is also deleted |

## Lab responsibilities

| Member | Feature and shared work |
| --- | --- |
| Asshifa | Account routes, validation, authentication, account tests, Express and database setup |
| Prottasha Saha Ayoishee | Counselor routes, directory search, ownership checks, profile tests, test setup and database isolation |

For the demo, each member can trace one request through validation, the Prisma database operation, and the Express response, then show the matching integration test.
