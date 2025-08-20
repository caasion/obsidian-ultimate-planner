// We need a store because I can't pass settings objects as props and directly modify them easily, especially not when I want individual components to communicate.

// I need stores for Action Items since it can be accessed by the editor or the ultimate planner view.

import { writable } from 'svelte/store';
import type { ActionItem } from './types';

export const actionItemsStore = writable<ActionItem[]>([]);