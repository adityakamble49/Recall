# AGENTS.md

## Live Reload Pattern

All mutations that change data (bookmarks, collections, trash) MUST follow this pattern:

```
1. await serverAction(...)    // Wait for DB write to complete
2. await refresh()            // Fetch fresh data from server
```

### Rules
- Always `await` the server action before calling `refresh()`
- Always `await refresh()` in mutation handlers (not fire-and-forget)
- `refresh()` fetches ALL state: bookmarks, collections, deletedCollections
- The only place `refresh()` can be fire-and-forget is the 30s polling interval
- Never use `revalidatePath` — all state is managed client-side via `refresh()`
- Clear any local UI state (selection, forms) before or after refresh as needed

### Where refresh() is defined
- `components/DashboardContent.tsx` — fetches `getAllBookmarks`, `getCollectionsWithCount`, `getDeletedCollections` in parallel

### Checklist for new mutations
- [ ] Server action awaited
- [ ] `await refresh()` called after
- [ ] Any event handler calling the mutation is `async`
- [ ] No `revalidatePath` in the server action
