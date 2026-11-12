# Report format

Use this order. The segment split goes first because it's usually the finding.

```
## <Mode>: <short name of what was tested>
Sample: <n> personas across <k> companies · <roles>

### By segment
| Segment            | A        | B        | Split? |
|--------------------|----------|----------|--------|
| Insurance broker   | 31 (10)  | 58 (10)  |        |
| CFO                | 72 (10)  | 49 (10)  | ⚠ A wins |
| IT manager         | 44 (10)  | 47 (10)  |        |
| Safety manager     | 81 (10)  | 66 (10)  |        |
| Frontline worker   | 22 (10)  | 51 (10)  | ⚠ 59-pt spread in A |
| High pain          | ...      | ...      |        |
| Low pain           | ...      | ...      |        |

### Distribution
Mean / P80 (the top-20% outcome) / share scoring above 70, per version.

### What personas said
3–4 short quotes spanning low, medium and high pain. At least one detractor.
> "Quote." (Title, industry, company size, score)

### What to fix
2–4 specific edits, each tied to the segment it would move.

### Take to real customers
2–3 questions this run says matter, for your customer advisory board or customer interviews.
```

Mark a **split** when, within one version, the best and worst roles differ by 20 or more points,
or when the overall winner loses a segment by 10 or more points.
