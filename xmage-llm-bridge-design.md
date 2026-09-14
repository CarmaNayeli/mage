# XMage LLM Bridge — State Serialization Design

The contract between the Java fork and the sidecar. Get this right and everything else is plumbing.

---

## Five principles

**1. Perspective-relative, always.** Serialize from the deciding player's seat. Opponents' hands are counts, not contents. Libraries are counts. If the bot can see it in a real game, it goes in; if not, it doesn't exist. This is not just fairness — a model that can see hidden information will play in ways that read as cheating even when it isn't trying to.

**2. The engine enumerates, the model selects.** Never ask the model what to do. Ask it to pick an index from a list of legal actions that XMage generated. Illegal plays become structurally impossible, parsing becomes trivial, and you never write a validator.

**3. Deduplicate card text ruthlessly.** Eight Cat tokens with identical text should cost you one glossary entry, not eight. Board state references cards by a short id; a separate `glossary` object holds each unique card's oracle text once.

**4. Omit what's inferable.** Basic lands need no oracle text. A vanilla 2/2 needs no oracle text. Only include `text` when the card actually does something.

**5. Carry a memory field.** The bridge is stateless per call but the game isn't. The model writes a short `notes` string each turn and you feed it back on the next call. This is where threat assessment and political state live, and it's the only reason the bot can be any good at multiplayer.

---

## Request envelope

```json
{
  "schema": 1,
  "decision": {
    "type": "declare_attackers",
    "prompt": "Declare attackers for combat.",
    "options": [ ... ],
    "min_choices": 0,
    "max_choices": 8
  },
  "you": {
    "seat": 2,
    "name": "Teysa Bot",
    "life": 34,
    "commander": { "name": "Teysa Karlov", "zone": "battlefield", "tax": 0, "cast_count": 1 },
    "hand": [ ... ],
    "battlefield": [ ... ],
    "graveyard": { "count": 9, "notable": ["c_livingdeath", "c_regalcaracal"] },
    "mana_available": { "W": 3, "B": 2, "any": 1, "total": 6 },
    "lands_played_this_turn": 1
  },
  "opponents": [ ... ],
  "stack": [ ... ],
  "turn": { "number": 9, "active_seat": 2, "phase": "combat_begin", "is_your_turn": true },
  "glossary": { ... },
  "notes": "Seat 3 (Ur-Dragon) is the threat — 3 fliers, 8 lands, killed seat 1's blocker last turn. Seat 4 durdling, low priority. My Grave Pact is the key permanent; hold Flawless Maneuver for it. Seat 4 asked me not to attack them, honoring for now.",
  "history": [
    "T8 seat3: cast Scion of the Ur-Dragon, attacked seat1 for 9",
    "T8 seat4: played land, passed",
    "T9 seat2 (you): drew Skullclamp"
  ]
}
```

### Permanent object

```json
{
  "id": "p_1042",
  "card": "c_regalcaracal",
  "name": "Regal Caracal",
  "types": ["Creature"],
  "subtypes": ["Cat"],
  "power": 3, "toughness": 4,
  "tapped": false,
  "summoning_sick": false,
  "counters": { "+1/+1": 2 },
  "attached": ["p_1055"],
  "attached_to": null,
  "is_token": false,
  "controller": 2,
  "can_attack": true,
  "keywords": ["lifelink"]
}
```

`power`/`toughness` are **current** values after all continuous effects. Don't make the model apply the layer system. It will get it wrong and you'll never know why.

`keywords` is the resolved set including granted ones — Teysa's lifelink grant shows up here, not only in her oracle text.

### Hand card object

```json
{
  "id": "h_88",
  "card": "c_gravepact",
  "name": "Grave Pact",
  "mana_cost": "{2}{B}{B}",
  "mv": 4,
  "types": ["Enchantment"],
  "castable_now": true
}
```

`castable_now` is computed by the engine. It saves the model doing mana math badly.

### Option object

```json
{
  "index": 3,
  "label": "Attack seat 3 with Leonin Warleader (4/4, lifelink, vigilance)",
  "action": "attack",
  "source": "p_1071",
  "target_seat": 3
}
```

`label` is what the model reads. The structured fields are what your bridge uses to execute. Never make the model produce the structured fields.

### Glossary

```json
{
  "c_gravepact": "Whenever a creature you control dies, each other player sacrifices a creature.",
  "c_regalcaracal": "When Regal Caracal enters, create two 1/1 white Cat creature tokens with lifelink. Other Cats you control get +1/+1 and have lifelink."
}
```

Include an entry only for cards currently visible in the payload. Skip basics and vanillas.

---

## Response

```json
{
  "choice": 3,
  "also": [5, 7],
  "notes": "Seat 3 still the threat. Attacking them with everything except Mirri, holding her as a blocker. Grave Pact online so I can afford to trade. Seat 4 still neutral — will renege next turn if they untap with their combo piece.",
  "say": "Sorry friend, the dragons have to go."
}
```

- `choice` — the index. Single-select decisions use only this.
- `also` — additional indices for multi-select (attackers, blockers, modal).
- `notes` — replaces the stored notes wholesale. Cap it in the prompt, 500 characters or so, or it grows without bound.
- `say` — optional table talk, surfaced in your spectator view. Costs almost nothing and it's most of the entertainment value.

---

## Escalation policy

The whole viability of this rests on not calling the API for every decision. XMage's `Player` interface has dozens of methods and most calls are mechanical noise.

**Route to the model:**
- `priority` when there's a real choice of spell or ability to cast
- `selectAttackers` / `selectBlockers`
- `chooseTarget` when targets include opponents or opposing permanents
- `chooseUse` for optional costs and effects with real tradeoffs
- `announceXMana`
- Modal spell selection

**Let inherited `ComputerPlayer` handle:**
- Mana payment and land tapping
- Ordering simultaneous triggers you control
- Choosing between functionally identical objects
- Any `chooseUse` where one answer is strictly better
- Scry, surveil, and similar ordering below a threshold you set

Method names above are from memory of the XMage source — verify the actual signatures against `ComputerPlayer.java` in `mage-player-ai` before building against them.

Start with **everything** logged and **nothing** escalated. Play one full four-player game and count the calls by method. That tells you where the real noise is, and it'll be somewhere you didn't predict.

---

## Cost, which is the thing that will surprise you

Rough mid-game payload: 40 permanents at ~25 tokens is 1,000; hand around 400; options 300; glossary 600; notes and history 400. Call it **3,000 input tokens**.

With the escalation filter, maybe 15 real decisions per player per turn cycle. Three LLM bots, 12-turn game:

```
15 × 3 × 12 = 540 calls × 3,000 tokens ≈ 1.6M input tokens per game
```

That's not nothing. Mitigations in order of impact:

1. **Prompt caching.** The rules explanation, the response format, and the deck lists are static across every call in a game. Cache them and you're only paying full price for the dynamic state.
2. **One LLM bot, two dumb ones.** Cuts it by two thirds, and honestly a mixed table is a better test anyway — you find out if your bot beats the baseline.
3. **Tighten the escalation filter.** Every decision you push back down to `ComputerPlayer` is free.
4. **A smaller model for the boring escalations.** Blocks and targeting don't need your best model; the political reasoning does.

---

## Gotchas

**Hidden information leaks through option labels.** If an option says "Counter Cryptic Command," you've just told the bot what's on the stack, which is fine — but be careful with labels generated from cards in hidden zones. Audit your label generation once, specifically.

**The stack is where bots embarrass themselves.** Include the full stack with source and targets, and make sure the model knows it can respond and also that passing is usually correct. Untrained, it will respond to everything.

**Summoning sickness and vigilance need to be explicit booleans.** Don't rely on the model inferring them from the presence of a keyword and a turn counter.

**Commander tax and commander damage per opponent both matter** and both get forgotten. Put them in the envelope from day one.

**`notes` will drift.** The model rewrites it every call and it slowly turns to mush over 12 turns. Consider regenerating it fresh once per turn from a dedicated "assess the table" call rather than letting it mutate on every decision.

---

## First evening

1. Clone, get the Maven multi-module build to complete. This takes a while. Start it, go do something else.
2. Subclass `ComputerPlayer`, override nothing, register it, confirm a game runs.
3. Add logging to every overridable method. Play one four-player AI game. Count calls by method.
4. Build the serializer for `you.battlefield` only, dump it to stdout, eyeball it against the game window.

No HTTP, no model, no browser. If step 4 produces JSON that matches what you see on screen, the hard part is done.
