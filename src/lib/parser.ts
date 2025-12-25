// PURPOSE: Provides tools to extract the desired section header and the information from the header section

import type { PlannerActions } from "src/actions/itemActions";
import type { DataService, Element, ISODate, ItemData, LineInfo } from "src/types";

export interface ParserDeps {
	data: DataService;
	plannerActions: PlannerActions;
}

export class PlannerParser {
	private data: DataService;
	private plannerActions: PlannerActions;

	constructor(deps: ParserDeps) {
		this.data = deps.data;
		this.plannerActions = deps.plannerActions;
	}

    static extractSection(content: string, sectionHeading: string): string {
        const lines = content.split('\n');
        let sectionLines: string = "";
        let inSection = false;

        for (const line of lines) {
            // Check if we hit our target heading
            if (line.trim() === `## ${sectionHeading}`) {
                inSection = true;
                continue;
            }
            // If we hit another heading of the same or higher level, stop
            if (inSection && line.startsWith('##')) break; 
            
            if (inSection) sectionLines += `\n${line}`;
        }
        return sectionLines;
    }
    
    public parseSection(date: ISODate, section: string): ItemData[] {
	    const lines = section.split('\n');
		const itemData: ItemData[] = [];
		let currItem: ItemData | null = null;
		let currElement: Element | null = null; 
		
		for (let line of lines) {
			// Skip empty lines or lines that aren't bullet points
			if (!line || !line.match(/^\t*- /)) continue;
			
			// If the line starts with a bullet point with no tab, then start a new item.
			if (line.match(/^- /m)) { 
                // Push the old element if it exists
				if (currElement && currItem) currItem.items.push(currElement);

				// Push the old item if it exists
				if (currItem) itemData.push(currItem);
				
				// Initialize the new item
				let text = line.replace(/^- (\[.\] )?/, '').trim();
				
				// Strip metadata like [🕛:: 2 hours]
				text = text.replace(/\[.*?::.*?\]/g, '').trim();

				console.log(date);
				console.log(this.plannerActions.getTemplateDate(date));
				
				currItem = {
					id: this.data.getItemFromLabel(this.plannerActions.getTemplateDate(date), text),
					time: 60,
					items: [],
				}
				
			} else if (line.match(/^\t- /)) {
				// Push the old element if it exists
				if (currElement && currItem) currItem.items.push(currElement);
				
				// Initialize the new element
				currElement = PlannerParser.parseElementLine(line);
				
			} else if (line.match(/^\t\t- /)) {
				if (currElement) {
					const text = line.replace(/^\t\t- /, '').trim();
					currElement.children.push(text);
				}
			}
		}

        // Push the old element if it exists
        if (currElement && currItem) currItem.items.push(currElement);

        // Push the old item if it exists
        if (currItem) itemData.push(currItem);

        return itemData;
    }
    
    private static parseElementLine(line: string): Element {
	    // Try to match with time information
	    const withTimeMatch = line.match(/^\t(- \[(.?)\] |- )(.*?) @ (.*)/);
	    
	    if (withTimeMatch) {
	        const [, id, checkmark, text, timeStr] = withTimeMatch;
	        
	        // Parse time: format like "10:00 (2 hr)" or "12:00 (30 min)"
	        const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*\((\d+)\s*(h|hr|hrs|m|min|mins)\)/);
	        
	        const element: Element = {
	            raw: line,
	            text: text.trim(),
	            children: [],
	            isTask: id.includes('[ ]') || id.includes('[x]'),
	            checked: id.includes('[x]'),
	        };
	        
	        if (timeMatch) {
	            const [, hours, minutes, rawDuration, units] = timeMatch;
	            element.startTime = { hours: parseInt(hours), minutes: parseInt(minutes) };
	            element.duration = units.startsWith('h') ? parseInt(rawDuration) * 60 : parseInt(rawDuration);
	        }
	        
	        return element;
	    }
	    
	    // Handle without time information
	    const noTimeMatch = line.match(/^\t(- \[(.?)\] |- )(.*)/);
	    
	    if (noTimeMatch) {
	        const [, id, checkmark, text] = noTimeMatch;
	        return {
	            raw: line,
	            text: text.trim(),
	            children: [],
	            isTask: id.includes('[ ]') || id.includes('[x]'),
	            checked: id.includes('[x]'),
	        };
	    }
	    
	    // Fallback for malformed lines
	    return {
	        raw: line,
	        text: line.replace(/^\t- /, '').trim(),
	        children: [],
	        isTask: false,
	    };
    }
}