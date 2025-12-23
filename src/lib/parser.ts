// PURPOSE: Provides tools to extract the desired section header and the information from the header section

import type { Element, ItemData, LineInfo } from "src/types";

export class PlannerParser {
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
    
    static parseSection(section: string): ItemData[] {
	    const lines = section.split('\n');
		const itemData: ItemData[] = [];
		let currItem: ItemData | null = null;
		let currElement: Element | null = null;
		
		for (const line of lines) {
			// Continue of the current line isn't a bullet point
			if (!line.match(/^\t*- /)) continue;

            console.log(line)
		
			// If the line starts with a bullet point with no tab, then start a new item.
			if (line.match(/^- /m)) { 
                // Push the old element if it exists
				if (currElement && currItem) currItem.items.push(currElement);

				// Push the old item if it exists
				if (currItem) itemData.push(currItem);
				
				// Initialize the new item
				const text = line.replace(/- /, '').trim();
				currItem = {
					id: text,
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
	    return {
			raw: line,
			text: line.replace(/- \[[ x]\] |- /, '').trim(),
			children: [],
			isTask:  line.includes('- [ ]') || line.includes('- [x]'),
			checked: line.includes('- [x]'),
			startTime: {hours: 0, minutes: 0},
			duration: 0,
		};
    }
}