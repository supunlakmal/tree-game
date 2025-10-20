./lib/scores.ts:169:93
Type error: Property 'username' does not exist on type 'never'.

167 |
168 | // Extract username from the joined users table

> 169 | const username = Array.isArray(score.users) ? score.users[0]?.username : score.users?.username;

      |                                                                                             ^

170 |
171 | if (!username) {
172 | console.warn(`Score ${score.id} has no associated username`);
Next.js build worker exited with code: 1 and signal: null
