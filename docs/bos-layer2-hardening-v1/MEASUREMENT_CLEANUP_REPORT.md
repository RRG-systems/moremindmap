# Measurement Cleanup Report

## Topology threshold

`inferCommunicationStyle` compared the sum of two topology scores to `12.0`, a legacy 0-to-10 threshold that made the high emotional-smoothing branch unreachable on the current topology scale.

The comparison now uses the existing `topologyThreshold(12.0)` contract helper, producing the intended normalized threshold of `1.2` without changing score production or bands.

Focused tests prove high, moderate, and low branches are reachable.

## Null canonical behavior

The malformed null fallback referenced undeclared variables and only attempted four sections. It has been replaced with the same ten-section Layer 2 abstention projection used by other failure paths.

## Scope

No psychological model, question, dimension, scoring weight, evidence threshold, or claim policy changed.
