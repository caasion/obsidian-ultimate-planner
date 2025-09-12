<a id="readme-top"></a>

<!-- ABOUT THE PROJECT -->
## About The Project

![Ultimate Planner Screen Shot][product-screenshot]

The Ultimate Planner is an [Obsidian](https://obsidian.md) plugin to make long-term planning much simpler. Instead of being stuck with rigid todo lists, you can plan what to do for each action item (i.e. a course or a fitness goal) over the long-term.

I've started to document my development of this plugin! Please see ![devlog]!

### Built With
[![Svelte][Svelte.dev]][Svelte-url] [![Typescript][Typescript]][Typescript-url]

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- GETTING STARTED -->
## Getting Started

To compile the project, install npm:
  ```sh
  npm install npm@latest -g
  ```

To install:

1. Clone the repo
   ```sh
   git clone https://github.com/caasion/obsidian-ultimate-planner
   ```
2. Install NPM packages
   ```sh
   npm install
   ```
3. Compile Project
    ```sh
    npm run dev
    ```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- USAGE EXAMPLES -->
## Usage

The plugin is based on a long-term calendar planning style. There are action items (which are things that you do) associated with each day. Each row represents an action item.

The table format is conducive to daily planning as you can see your tasks/plans across rows for one day. 
![Ultimate Planner Column][column]

At the same time, it is conducive to long-term planning as you can plan what to do for one action item individually across columns.
![Ultimate Planner Row][row]

I designed the plugin to be a flexible planner, knowing that goals and objectives change over time. There are many features to add, remove, extend action items as time goes on. Currently, I am working on a templates editor page.

I also implemented some QoL features to make the planner more user friendly:
- Tab and shift-tab navigation
- Rename and change color of action items
- Easy date navigation through weeks

<!-- ROADMAP -->
## Roadmap

Ongoing
- Add support to display multiple views
- Templates Editor View
- Add ability to export to csv or markdown

Planned
- Add custom calendar navigator prompt (Use a by-week date navigator instead of a by-day date navigator)

Completed
- Added right click context menu to rename AI (Action Item), extend or end action item
- Added "Add" button at top of calendar
- Added buttons for date navigation (through weeks and calendar view)
- Designed efficient data structure for storing calendar data
- Added Markdown editor to cells (with Milkdown)


<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTRIBUTING -->
## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".
Don't forget to give the project a star! Thanks again!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

<p align="right">(<a href="#readme-top">back to top</a>)</p>


<!-- ACKNOWLEDGMENTS -->
## Acknowledgments

* [Othneil Drew's Best Readme Template](https://github.com/othneildrew/Best-README-Template/tree/main)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->

[product-screenshot]: docs/sample.png
[row]: row.jpg
[column]: column.jpg
[Svelte.dev]: https://img.shields.io/badge/Svelte-4A4A55?style=for-the-badge&logo=svelte&logoColor=FF3E00
[Svelte-url]: https://svelte.dev/
[Typescript]: https://shields.io/badge/TypeScript-3178C6?logo=TypeScript&logoColor=FFF&style=flat-square
[Typescript-url]: https://typescriptlang.org
[devlog]: docs/devlog.md
