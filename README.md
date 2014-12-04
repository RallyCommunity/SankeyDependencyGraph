SankeyDependencyChart
=========================

## Overview
Based on the Sankey D3 Visualization, this app looks at all dependencies within a Rally Project and graphs the flow of Dependencies.

This app will use the Lookback API when available and fallback to the standard Webservices API otherwise. WSAPI can be slower to use depending on the number of dependencies in the project.

## Screenshot
![screen shot 2014-06-27 at 4 52 37 pm](https://cloud.githubusercontent.com/assets/701752/3417780/0e45167a-fe3d-11e3-80ed-eb0fa62d0690.png)

## December 4, 2014 Updated to support Portfolio Item Dependencies

To visualize portfolio item dependencies

* Select the App Edit menu (gear icon) and the Edit App Settings menu item. 
* Check 'Show Portfolio Items'
* Choose the Portfolio Item Type (portfolio item dependencies are always between the same type)

![settings-dialog](https://raw.githubusercontent.com/RallyCommunity/SankeyDependencyGraph/portfolio-items/docs/portfolio-settings.png | height = 100px)


![portfolio-chart](https://raw.githubusercontent.com/RallyCommunity/SankeyDependencyGraph/portfolio-items/docs/portfolio-dependencies.png)



## License

AppTemplate is released under the MIT license.  See the file [LICENSE](https://raw.github.com/RallyApps/AppTemplate/master/LICENSE) for the full text.
