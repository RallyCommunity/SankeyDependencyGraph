var Ext = window.Ext4 || window.Ext;
var _ = window._;

Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',

    launch: function() {
      this.nodes = [];
      this.links = [];
      this.oidMap = {};
      this.noPred = 0;
      this.noSuc = 0;

      this.loadData();
    },

    loadData: function () {
      var sss = Ext.create('Rally.data.lookback.SnapshotStore', {
        autoLoad: false,
        context: {
          workspace: this.getContext().getWorkspaceRef()
        },
        fetch: ['Name', 'PlanEstimate', 'Predecessors', 'Successors', 'Blocked', 'BlockedReason', 'ScheduleState', 'DisplayColor'],
        hydrate: ['ScheduleState'],
        find: {
          _TypeHierarchy: 'HierarchicalRequirement',
          _ProjectHierarchy: { $in: this.getContext().getProject().ObjectID },
          __At: 'current',
          $or: [
            { Successors: { $ne: null } },
            { Predecessors: { $ne: null } }
          ]
        }
      });

      sss.load({
        scope: this,
        callback: function (records, options, success) {
          var source, target;

          _.each(records, function (rec) {
            this.nodes.push({
                name: rec.get('Name'),
                size: rec.get('PlanEstimate'),
                displayColor: rec.get('DisplayColor') || '#00A9E0',
                ref: '/hierarchicalrequirement/' + rec.get('ObjectID')
            });
            this.oidMap[rec.get('ObjectID')] = this.nodes.length - 1;
            if (rec.get('Predecessors').length === 0) { this.noPred++; }
            if (rec.get('Successors').length === 0) { this.noSuc++; }
          }, this);

          _.each(records, function (rec) {
            source = this.oidMap[rec.get('ObjectID')];

            _.each(rec.get('Successors'), function (suc) {
              target = this.oidMap[suc];

            if (_.isNumber(source) && _.isNumber(target)) {
                this.links.push({source: source, target: target, value: 1});
              }
            }, this);
          }, this);

          this.render();
        }
      });
    },

    render: function () {
      var w = this.getWidth(),
          h = this.getHeight(),
          t = (this.noPred > this.noSuc) ? this.noPred : this.noSuc;

     if (t * 32 > h) { h = (t + 2) * 32; };

      var margin = {top: 1, right: 1, bottom: 6, left: 1},
          width = w - margin.left - margin.right,
          height = h - margin.top - margin.bottom;

      var formatNumber = d3.format(",.0f"),
          format = function(d) { return formatNumber(d) + " SP"; },
          color = function (c) { return c; };

      var svg = d3.select(this.getEl().dom).append('svg')
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
      .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

      var sankey = d3.sankey()
        .size([width, height])
        .nodeWidth(15)
        .nodePadding(10)
        .nodes(this.nodes)
        .links(this.links)
        .layout(32);

      var path = sankey.link();

      var link = svg.append("g").selectAll(".link")
        .data(this.links)
      .enter().append("path")
        .attr("class", "link")
        .attr("d", path)
        .style("stroke-width", function(d) { return Math.max(1, d.dy); })
        .sort(function(a, b) { return b.dy - a.dy; });

      link.append("title")
        .text(function(d) { return d.source.name + " →  " + d.target.name });

      var node = svg.append("g").selectAll(".node")
        .data(this.nodes)
        .enter().append("g")
        .attr("class", "node")
        .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; })
      .call(d3.behavior.drag()
        .origin(function(d) { return d; })
        .on("dragstart", function() { this.parentNode.appendChild(this); })
        .on("drag", dragmove));

      node.append("rect")
        .attr("height", function(d) { return d.dy; })
        .attr("width", sankey.nodeWidth())
        .style("fill", function(d) { return d.color = color(d.displayColor); })
        .style("stroke", function(d) { return d3.rgb(d.color).darker(2); })
        .append("title")
        .text(function(d) { return d.name + "\n" + format(d.size); });

      node
        .on('dblclick', function (d) { Rally.nav.Manager.showDetail(d.ref); });

      node.append("text")
        .attr("x", -6)
        .attr("y", function(d) { return d.dy / 2; })
        .attr("dy", ".35em")
        .attr("text-anchor", "end")
        .attr("transform", null)
        .text(function(d) { return Ext.util.Format.ellipsis(d.name, 60, true); })
        .filter(function(d) { return d.x < width / 2; })
        .attr("x", 6 + sankey.nodeWidth())
        .attr("text-anchor", "start");

      function dragmove(d) {
        d3.select(this).attr("transform", "translate(" + d.x + "," + (d.y = Math.max(0, Math.min(height - d.dy, d3.event.y))) + ")");
        sankey.relayout();
        link.attr("d", path);
      }
    }
});
