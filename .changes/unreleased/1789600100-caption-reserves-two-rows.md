---
type: Fixed
title: A card no longer changes height when a row's sentence runs to two lines
---

The caption bar at the foot of the start, options, keyboard and developer cards now reserves two rows whether or not there is anything in it, so the card stands still while the pointer crosses its rows. It had reserved one — the floor was written as two lines of text but the bar's own padding came out of it — and every sentence that ran to a second line pushed the card 11 px taller, which on a centred card moves every button away from the press already aimed at it.
