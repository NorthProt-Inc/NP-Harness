---
name: perf-anly
description: Use when analyzing performance — bottlenecks, complexity, N+1 queries
metadata:
  pi:
    argument-hint: <file-or-function>
    user-invocable: true
---

# /perf - Performance Analysis

Analyzes code performance characteristics and identifies optimization opportunities.

## Arguments
- `$ARGUMENTS`: File path or function name to analyze

## Analysis Items

### 1. Time Complexity
Big O notation analysis:
- O(1) - Constant time
- O(log n) - Logarithmic
- O(n) - Linear
- O(n log n) - Linearithmic
- O(n^2) - Quadratic
- O(2^n) - Exponential

### 2. Space Complexity
Memory usage analysis:
- Additional data structures
- Recursion stack depth
- Large data copies

### 3. I/O Bottlenecks
- Synchronous file/network I/O
- I/O calls inside loops
- Unbuffered large reads/writes

### 4. Database Patterns

#### N+1 Queries

##### Python (SQLAlchemy)
```python
# N+1 query pattern
for user in users:
    orders = db.query(Order).filter_by(user_id=user.id).all()  # Bad

# Improved
orders = db.query(Order).filter(Order.user_id.in_([u.id for u in users])).all()  # Good
```

##### TypeScript (Drizzle/SQL)
```typescript
// N+1 query pattern
for (const user of users) {
  const orders = await db.select().from(ordersTable)
    .where(eq(ordersTable.userId, user.id));  // Bad
}

// Improved: IN query
const orders = await db.select().from(ordersTable)
  .where(inArray(ordersTable.userId, users.map(u => u.id)));  // Good
```

#### Other DB Patterns
- **SELECT ***: Fetching unnecessary columns
- **Missing indexes**: On WHERE/JOIN conditions
- **Bulk INSERT**: No batch processing

### 5. Unnecessary Operations
- Redundant calculations inside loops (can be hoisted)
- Missing caching for recomputable values
- Unnecessary deep copies

## Check Patterns

### Python
```python
# Redundant calculation in loop
for item in items:
    result = expensive_operation()  # Bad - called every iteration
    process(item, result)

# Improved
result = expensive_operation()  # Good - outside loop
for item in items:
    process(item, result)
```

```python
# Inefficient string concatenation
result = ""
for s in strings:
    result += s  # Bad - O(n^2)

# Improved
result = "".join(strings)  # Good - O(n)
```

### TypeScript
```typescript
// Unnecessary spread copy
const items: Item[] = [];
for (const item of source) {
  items = [...items, item];  // Bad - O(n^2)
}

// Improved
const items = source.map(transform);  // Good - O(n)
```

### SQL
```sql
-- N+1 queries (ORM-generated)
SELECT * FROM users;
SELECT * FROM orders WHERE user_id = 1;
SELECT * FROM orders WHERE user_id = 2;
...

-- Improved: JOIN or IN
SELECT u.*, o.* FROM users u
LEFT JOIN orders o ON u.id = o.user_id;
```

## Profiling Tools

### Python
```bash
# cProfile
python -m cProfile -s cumtime script.py

# line_profiler (per-line in functions)
kernprof -l -v script.py

# memory_profiler
python -m memory_profiler script.py
```

### Node.js
```bash
# V8 profiler
node --prof app.js
node --prof-process isolate-*.log

# --inspect (Chrome DevTools)
node --inspect app.js
```

### General
```bash
# Execution time
time python script.py

# System resource monitoring
htop
```

## Output Format

```markdown
## Performance Analysis

### Target
- File: `src/services/data_processor.py`
- Function: `process_batch()`

### Complexity
- Time: O(n^2) -> O(n log n) possible
- Space: O(n)

### Issues Found

#### [HIGH] N+1 Query
- Location: `data_processor.py:45`
- Current: Individual queries in loop (100 users -> 101 queries)
- Recommended: Use `selectinload()` or `joinedload()`

#### [MEDIUM] Redundant Calculation in Loop
- Location: `data_processor.py:62`
- Current: `get_config()` called every iteration
- Recommended: Move outside loop

### Optimization Suggestions
1. Eager loading to resolve N+1 (expected: 90% query reduction)
2. Apply result caching (expected: 50% time reduction)
```

## Notes
- "Premature optimization is the root of all evil" -- measure first, optimize when needed
- Base decisions on profiling results
- Consider readability vs performance trade-offs
- Benchmark before and after optimization
