var Ext = window.Ext4 || window.Ext;
var _ = window._;
var app = null;

Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',

    fetch: ['ObjectID','FormattedID','Name', 'PlanEstimate', 'Predecessors', 'Successors', 'Blocked', 'BlockedReason', 'ScheduleState', 'DisplayColor','Release','Parent'],

    config: {

      defaultSettings : {
        showPortfolioItems : true,
        releaseName : "",
        parentId : ''
      }
    },

    getSettingsFields: function() {

    return [
      {
        name: 'showPortfolioItems',
        xtype: 'rallycheckboxfield',
        label: 'Check to chart Portfolio Items',
        width : 300
      },
      {
                name: 'parentId',
                xtype: 'rallytextfield',
                label : "Parent Portfolio Item (ID), if specified view will be be filtered to children of this item. eg. I292"
      }
    ];
    },

    setTimeBoxRelease : function() {
      var timeboxScope = this.getContext().getTimeboxScope() ;
      if (timeboxScope) {
        var record = timeboxScope.getRecord();
        app.releaseName = timeboxScope.getType() === 'release' ? record.get('Name') : null;
      } else {
        app.releaseName = null;
      }
    },


    launch: function() {
      app = this;
      this.nodes = [];
      this.links = [];
      this.oidMap = {};
      this.noPred = 0;
      this.noSuc = 0;

      // get timebox
      this.setTimeBoxRelease();


      app.showPortfolioItems = app.getSetting('showPortfolioItems');

      if (app.showPortfolioItems) {

        var piStore = Ext.create('Rally.data.wsapi.Store', {
          // model: 'UserStory',
          model : 'TypeDefinition',
          autoLoad: false,
          fetch: ['Name','TypePath'],
          filters : [{property:"Creatable",operator:"=",value:true},
                      {property:"Ordinal",operator:"=",value:0}],
          limit: Infinity
        });

        piStore.load({
          scope: this,
          callback: function (records, options, success) {
            // console.log("read:",records.length,records);
            app.piTypePath = _.first(records).get("TypePath");
            // console.log("type:",app.piTypePath);
            app.loadDataWS();
          }
        });

      } else {
        if ( !_.isUndefined(window) && 
              !_.isUndefined(window.parent) &&
                !_.isUndefined(window.parent.FEATURE_TOGGLES) &&
                  (window.parent.FEATURE_TOGGLES.A2_ENABLE_CHARTING_APPLICATIONS === true) &&
                  (app.showPortfolioItems===false)) {
                    this.loadDataLB();
                  } else {
                    this.loadDataWS();        
                }
      }

    },

    onTimeboxScopeChange: function(newTimeboxScope) {
      this.callParent(arguments);
      app.setTimeBoxRelease();
      console.log("Release changed to:",app.releaseName);

      var svg = d3.select('svg');

      var selection = svg.selectAll(".artifact");

      selection
        .attr("style", function(d) { 
          return app._makeStyle(d,app.releaseName);
        });
    },

    _makeStyle : function(d,selectedRelease) {
        var style = '';
        if (selectedRelease!==null && d.release===selectedRelease) {
          style = 'stroke:red;stroke-width:2;fill:' + (d.displayColor);
        } else {
          style = 'stroke-width:1;stroke:'+ d3.rgb(d.color).darker(2) + ';fill:'+(d.displayColor);
        }
        return style;
    },

    _makeDataObj: function (rec) {
      return {
        release : rec.get('Release') !== null ? rec.get('Release')._refObjectName : null ,
        formattedid : rec.get('FormattedID'),
        oid: rec.get('ObjectID'),
        name: rec.get('Name'),
        size: rec.get('PlanEstimate'),
        blocked: rec.get('Blocked'),
        displayColor: rec.get('DisplayColor') || '#00A9E0',
        ref: '/hierarchicalrequirement/' + rec.get('ObjectID'),
        parentId : rec.get('Parent') !== null ? rec.get('Parent').FormattedID : null
      };
    },

    loadDataWS: function () {
      var me = this;

      var parentId = me.getSetting("parentId");
      parentID = parentId !== null && parentId !== '' ? parentId : null;

      var filter = app.showPortfolioItems ? ( 
          app.releaseName !== null ? { property:"Release.Name",operator:"=",value:app.releaseName} : null
        ) : null;

      var wss = Ext.create('Rally.data.wsapi.Store', {
        // model: 'UserStory',
        model : app.showPortfolioItems ? /*'PortfolioItem/Feature'*/ app.piTypePath : 'UserStory',
        autoLoad: false,
        fetch: this.fetch,
        // filters : filter!==null ? [filter] : [],
        limit: Infinity
      });

      var getParent = function(r) {
        if (!_.isNull(r.get("Parent")))
          return r.get("Parent").FormattedID;
        else
          return null;
      }

      wss.load({
        scope: this,
        callback: function (records, options, success) {
          console.log("read:",records.length,records);
          var recs = _(records)
            .filter(function (rec) { return rec.data.PredecessorsAndSuccessors.Count; }, this)
            .map(function (rec) {
              var ret = [];
              var s = rec.get('ObjectID');

              if (rec.data.Successors.Count) {
                ret.push(rec.getCollection('Successors').load({fetch: me.fetch}).then(function (succs) {
                  _.each(succs, function (t) { 
                    // filter by parentId if specified
                    if (parentId===null) {
                      me.links.push({source: s, target: t.get('ObjectID'), link: 1});
                    }
                    else {
                      if ( getParent(rec) === parentId || getParent(t) === parentId)
                        me.links.push({source: s, target: t.get('ObjectID'), link: 1});
                    }
                  });
                  return true;
                }));
              }
              return ret;
            }, this)
            .flatten()
            .value();

          Deft.Promise.all(recs).then(function () {
            _(records)
              .filter(function (rec) { 
                return rec.data.PredecessorsAndSuccessors.Count; 
              })
              .each(function (rec) {
                var ll = _.find(me.links,function(link){
                  return rec.get("ObjectID") === link.source ||
                    rec.get("ObjectID") === link.target; 
                });
                if (!_.isUndefined(ll)) {
                  this.nodes.push(this._makeDataObj(rec));
                  this.oidMap[rec.get('ObjectID')] = this.nodes.length - 1;
                }

              }, me);

              // identify unlinked nodes
              me.unlinkedNodes = _.filter(me.nodes,function(node) {
                var ll = _.find(me.links,function(link){
                  return link.source === node.oid || link.target === node.oid;
                });
                return _.isUndefined(ll);
              });

            me.links = _(me.links)
              .map(function (l) { return { source: me.oidMap[l.source], target: me.oidMap[l.target], value: 1 }; })
              .filter(function (l) { return _.isNumber(l.source) && _.isNumber(l.target); })
              .value();

            me.render();
          });
        }
      });
    },

    loadDataLB: function () {
      var sss = Ext.create('Rally.data.lookback.SnapshotStore', {
        autoLoad: false,
        context: {
          workspace: this.getContext().getWorkspaceRef()
        },
        fetch: this.fetch,
        hydrate: ['ScheduleState'],
        find: {
          _TypeHierarchy: 'HierarchicalRequirement',
          _ProjectHierarchy: { $in: [this.getContext().getProject().ObjectID] },
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
            this.nodes.push(this._makeDataObj(rec));

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

      var me = this;

      console.log("me.links",this.nodes,this.links);


      var w = this.getWidth(),
          h = this.getHeight(),
          t = (this.noPred > this.noSuc) ? this.noPred : this.noSuc;

     if (t * 32 > h) { h = (t + 2) * 32; }

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
        .attr("class", function (d) { return d.source.blocked ? "blocked" : "link"; })
        .attr("d", path)
        .style("stroke-width", function(d) { return Math.max(1, d.dy); })
        .sort(function(a, b) { return b.dy - a.dy; });

      link.append("title")
        .text(function(d) { 
          var t = (d.source.formattedid + " " + d.source.name) + " ->  " + (d.target.formattedid + " " + d.target.name); 
          return t;
        });

      var node = svg.append("g").selectAll(".node")
        .data(this.nodes)
        .enter().append("g")
        .attr("class", "node") 
        .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; })
      .call(d3.behavior.drag()
        .origin(function(d) { return d; })
        .on("dragstart", function() { this.parentNode.appendChild(this); })
        .on("drag", dragmove));

      // hide any unlinked nodes. (may have been filtered out by selection)
      // node.attr("class",function(d) {
      //   var isUnlinked = !_.isUndefined(_.find(me.unlinkedNodes,function(n) {
      //     return n.oid === d.oid;
      //   }));
      //   return isUnlinked ? 'node hidden' : 'node';
      // })

      node.append("rect")
        .attr("class","artifact")
        .attr("height", function(d) { return d.dy; })
        .attr("width", sankey.nodeWidth())
        .attr('style',function(d){ return app._makeStyle(d,app.releaseName);})
        .append("title")
        .text(function(d) { return (d.formattedid + ":" + d.name) + "\n" + format(d.size); });

      node
        .on('dblclick', function (d) { Rally.nav.Manager.showDetail(d.ref); });

      node.append("text")
        .attr("x", -6)
        .attr("y", function(d) { return d.dy / 2; })
        .attr("dy", ".35em")
        .attr("text-anchor", "end")
        .attr("transform", null)
        .text(function(d) { return Ext.util.Format.ellipsis((d.formattedid+":"+d.name), 60, true); })
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
