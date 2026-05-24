# blind-game — Product Overview

## What is this?

A Game Master (GM) tool for running "blind map" tabletop sessions. Players cannot see the map — they are told only what their current cell contains and which adjacent cells they can move to. The GM sees everything and controls information flow.

Inspired by a YouTube format where a GM draws a grid map and players navigate it turn-by-turn based solely on verbal descriptions.

## Who uses it

**Game Master** — runs the tool on their screen, manages the session, controls information flow.

**Players** — each player has a separate view (`/play/:code/:playerId`) on their own device. They see only their own state (current cell, gold, HP, inventory) and can end their turn or spin a chance wheel themselves.

## Core concept

- GM creates a map (grid of cells with paths between them)
- GM creates a session: picks a map, adds players
- Each turn: GM announces what players can see/do → players decide → GM moves them
- Special cells (shop, trap, boss, loot) trigger game events the GM describes
- GM tracks gold and inventory for each player

## What makes it a "blind" game

Players never see the map. They build a mental model from GM descriptions. The tool helps the GM manage state without losing track — cell types, adjacency, player positions, gold, inventory, turn history.
