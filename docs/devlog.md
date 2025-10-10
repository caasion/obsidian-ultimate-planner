## 2025-10-09
- It's been a while since I've written a devlog because I pivoted to making a full documentation for Google Calendar Integration.
- I am currently working on an enhancement for that: multiple remote calendars & freezing past events.
- As of now (commit 0364779856255d8f3f7a078a234821f57a1692e0), 
    - I implemented two separate streams for the calendar cache and calendar frozen cells.
    - However, the frozen calendar cache doesn't seem to be working properly.
    - Upon testing, it seems as if the frozen cells are taking from the previous cache.
- I fixed it in commit 60ac691f927ecfbd7c3077732bee7cd197328c4e!
    - I found out that I was refencing the wrong objects because the functions I used relied on the cache, and not the current frozen index.


## 2025-09-23
- I hope to implement these features in the near future:
    - Google Calendar Integration
    - Daily Notes/Dataview Integration (ability to render items from dataview)
    - Daily Notes Navigation (click on the dates and get to that daily note)
    - Ability to display multiple weeks at a time
    - Different views (be able to show only a certain action item across several weeks)
- It's been a few days since I've updated. However, I've implemented several improvements:
    - Implemented clean-up when saving data
    - Added Style Tweaks
    - Add Settings Tabs 

## 2025-09-19
- I added a context-menu command to move aciton items up and down in a template
    - For simplicity, I've decided to move template modifications to the calendar itself, instead of having another view 
## 2025-09-17
- I'm struggling to find a user-friendly way to allow modification of action items
- With my action items, I aim to:
    - Allow it to be a one-off thing that I don't have to worry about after setting up
    - Provide flexibility when life changes and so does one's action items
    - Render the table in a concise way that doesn't take up a ton of space
- I added features "Extend until latest template" and "Remove form this date (until latest templates)" to allow for more fine-grain control of templates. Instead of having to manually click multiple times to add an action item to a template (if the template exists), this allows you to go all the way.
- I fixed the table's reactivity when completely removing action items by using the svelte component's reactive `templateStoreForDate` function instead of the non-reactive one
- I refactored the svelte component `UltimatePlanner.svelte` because there were still some functionalities unrelated to rendering that I could move out.
- I did various style tweaks to make the calendar look better
    - Adding colored headers for days of the week
    - Centering the Week Label
    - Simplifying week navigation buttons
    - Aligning + Add Button to the right
    - Aligning dates to the right
- Next time, I hope 
    - to improve the UI and UX of reordering templates in the TemplatesEditor tab
    - to implement clean-up when saving data (i.e. removing an action item)

## 2025-09-16
- I encountered a few problems today:
    - (1) The table doesn't update after removing a template from the editor (some issue with reactivity)
    - (2) There is a bloating of action items in the templates editor (and the general completion of the templates editor)
- (1) I found out that some of my functions use the `get()` function, which only gets a snapshot. Because of this, svelte doesn't know to rerun the function to get the updated values. Therefore, to fix this, I moved these reactive components from `helper.ts` and `itemActions.ts` back into the svelte component, since it was related to rendering the interface.
- (2) I will continue this tomorrow


## 2025-09-10
- Today, I worked to fix proper saving for the code.
- However, I also decided to do a big refactor (and pull out all the action functions out), so I also had to fix the saving again.
    - Now, the plugin is more centralized. There is debounced saving every time `plannerStore` changes, and the saving all occurs within the main plugin. Furthermore, since `plannerStore` is now the single source of truth, the components rely on it for reactivity and the plugin reads the store to save to settings. This centralized approach makes retrieving and modifying data much easier across components and in the plugin.
- I learnt how to use store and take advantage of their universality within and outside of svelte. I learned to differentiate between `$store` and `get(store)` (i.e. when I would use these functions). I also learned how to use `store.get()`, `store.subscribe()`, and `store.update()`.

## 2025-09-06
- I worked on the `TemplatesEditor` svelte component and its view
    - the goal is to create a friendly UI to manage templates (instead of having to go through the calendar)
    - For the templates editor view, I probably want to have my custom calendar view, with dots on the days where there are templates
    - I will be able to click on these dots/dates and see the template for that day
    - Templates modifications will include editing the action item (by left click), removing it from the template (will warn about issues), adding a new item, swapping the order of items
- I cleaned up filenames and added commands for the new view
- I am learning more about how to store data and allow for svelte components to communicate and have reactivity
    - → I will probably use a store where I subscribe and unsubscribe to
- I will continue to work on the user interface to manage templates (it's ugly and doesn't allow for color changes)
- Next Time:
    - Check for failsafes (what are things that can cause issues?)
    - Implement Clean-up features
        - ⋮☰ If I remove the last template of an action item, it removes the action item altogether
    - Add Custom Calendar Navigator Prompt (find a date picker module)
    - Add ability to render multiple weeks 
    - Ability to "collapse" action items (when there are changes)


## 2025-09-05
- I've been slowly working on this the past few days...
- I added a markdown editor to cells
- I fixed the tab and shift-tab navigation within markdown cells
- I worked on the styling (added)
- I implemented data saving — saving and loading of items in the 
- Next Time:
    - User interface to manage templates
    - Check for failsafes (what are things that can cause issues?)
    - Implement Clean-up features
        - ⋮☰ If I remove the last template of an action item, it removes the action item altogether
    - Add Custom Calendar Navigator Prompt (find a date picker module)
    - Add ability to render multiple weeks 
    - Ability to "collapse" action items (when there are changes)

## 2025-08-27
- I added a feature to extend and remove AI from templates (because I realized I could only add them)
- I refactored some code to make it more slim
- I fixed tsconfig-json so that I can build it instead of only running dev
- I did some styling (albeit incomplete)
- Next Time:
    - Add Markdown editor to cells ✔
    - Work on Styling
    - Add Custom Calendar Navigator Prompt (find a date picker moduile)
    - Add ability to render multiple weeks ✔ 
    - Ability to "collapse" action items (when there are changes)
    - User interface to manage templates
    - Check for failsafes (what are things that can cause issues?)


## 2025-08-26
- I refactored the data structure to make it more streamlined
    - instead of keeping a copy of the action item's metadata in each template and in each edited day, I now have a centralized storage for actionitem data and I only store the ids in the templates
    - I love this because now I can access the action items using the ids (by using a record) (I LOVE RECOORDS)
- I added a context menu, a modal, and a function to rename action items
- "New action item" also creates a new unique id in table
- Next Time:
    - work on "replace ID" function — (or do I really need this?)
    - add markdown editor to cells
    - work on styling
    - add custom calendar navigator prompt
    - ability to render multiple weeks

## 2025-08-25
- I've done quite a lot of stuff over the past few days, but i ahven't been keeping track of what I've been doing (which is a problem...)
- Today, I worked on finishing up the `DayData` logic (in terms of updating the templates)
- I will continue by working on features like renaming action items and creating new action items
- I also want to try working on saving the new data format now
- 🆕 I finished working on new action item creation
    - I also realized that I do not need to keep track of the action items on a per day basis. It does not make sense for an action item to have the same ID but a different name across time.
    - Therefore, I realized that I only need to keep track of the cells and the templates in order to have a complete table.
    - This is because renaming an action item should rename every instance associated with that id.
    - And creating new action items would generate a different ID and warrant a different name for that action item.
    - In summary, if I want to have a new action item from a date on, I would replace that action item with a new ID. If I simply want to rename a previous action item, then I will rename it from the past. it is possible to replace an action item with a new ID in the past, but that wouldn't have much impact as it would only generate a new MT row from that date on as no cellular data is transferred.
- Next Time:
    - Work on functions for renaming action items and replacing existing ones
    - Add user experience by adding a right click context menu to rename and replace ID (or "start new id from today")
    - "New action item" is used to create new row in table

## 2025-08-18
- Yesterday, I worked on the basic functionality for the plugin, implementing the data structure (`Record<ISODate, Record<string, string>>`). I also hooked it up to simple input cells in the tabble
- I learnt that I can use a `<pre>` tag to render the object live so it's easier to debug
- Also, GPT recommended that I focused on the whole calendar itself (in svelte) before addin gany features for saving
- GPT guided me to work on the data structure → one cell → one week → one week w/ multiple action items → week navigation → date picker
- Today, I am working on table navigation (being able to use shortcuts to go between cells)
    - A few future TODOs:
        - Better week navigation. Right now, I am picking a certain date, which then corresponds to a week. I could use the week input, but it starts on mondays. If I want to customize more, I can create my own calendar navigation that even allows for multi-week display
        - Table navigation for multiple weeks: right now, my nav assumes that I only have on week, so if I add support for multiple weeks, then I should add this feature too.


## 2025-08-17
- I want to break down the flow:
    - Currently, I have the settings tab and the planner view, which are independent entities.
    - I want to link these up, where I can `generateWeek` with the preset action items from settings, with the contents being empty
- Afterwards, I want to
    - work on saving the information to a json file in the vault (not settings)
    - then, allow for greater customizability 