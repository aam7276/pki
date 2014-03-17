/* --- BEGIN COPYRIGHT BLOCK ---
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; version 2 of the License.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
 *
 * Copyright (C) 2013 Red Hat, Inc.
 * All rights reserved.
 * --- END COPYRIGHT BLOCK ---
 *
 * @author Endi S. Dewata
 */

var Model = Backbone.Model.extend({
    parseResponse: function(response) {
        return response;
    },
    parse: function(response, options) {
        return this.parseResponse(response);
    },
    createRequest: function(attributes) {
        return attributes;
    },
    save: function(attributes, options) {
        var self = this;
        if (attributes == undefined) attributes = self.attributes;
        // convert attributes into JSON request
        var request = self.createRequest(attributes);
        // remove old attributes
        if (self.isNew()) self.clear();
        // send JSON request
        Model.__super__.save.call(self, request, options);
    }
});

var Collection = Backbone.Collection.extend({
    urlRoot: null,
    initialize: function(options) {
        var self = this;

        self.options = options;
        self.links = {};
        self.filter(null);
    },
    url: function() {
        return this.currentURL;
    },
    parse: function(response) {
        var self = this;

        // parse links
        var links = self.getLinks(response);
        links = links == undefined ? [] : [].concat(links);
        self.parseLinks(links);

        // convert entries into models
        var models = [];
        var entries = self.getEntries(response);
        entries = entries == undefined ? [] : [].concat(entries);

        _(entries).each(function(entry) {
            var model = self.parseEntry(entry);
            models.push(model);
        });

        return models;
    },
    getEntries: function(response) {
        return null;
    },
    getLinks: function(response) {
        return null;
    },
    parseEntry: function(entry) {
        return null;
    },
    parseLinks: function(links) {
        var self = this;
        self.links = {};
        _(links).each(function(link) {
            var name = link.rel;
            var href = link.href;
            self.links[name] = href;
        });
    },
    link: function(name) {
        return this.links[name];
    },
    go: function(name) {
        if (this.links[name] == undefined) return;
        this.currentURL = this.links[name];
    },
    filter: function(filter) {
        var self = this;

        var query = "";
        _(self.options).each(function(value, name) {
            query = query == "" ? "?" : query + "&";
            query = query + name + "=" + encodeURIComponent(value);
        });

        if (filter) {
            query = query == "" ? "?" : query + "&";
            query = query + "filter=" + encodeURIComponent(filter);
        }

        self.currentURL = self.urlRoot + query;
    }
});

var Page = Backbone.View.extend({
    initialize: function(options) {
        var self = this;
        Page.__super__.initialize.call(self, options);

        self.url = options.url;
    },
    load: function() {
    }
});

var Navigation = Backbone.View.extend({
    initialize: function(options) {
        var self = this;
        Navigation.__super__.initialize.call(self, options);

        self.content = options.content;
        self.pages = options.pages;
        self.homePage = options.homePage;

        $("li", self.$el).each(function(index) {
            var li = $(this);
            var link = $("a", li);
            var url = link.attr("href");
            link.click(function(e) {
                if (url == "#logout") {
                    if (options.logout) {
                        options.logout.call(self);
                    }

                } else if (url.charAt(0) == "#" && url.length > 1) {
                    // get page name
                    var name = url.substring(1);
                    self.load(name);
                }
                e.preventDefault();
            });
        });

        if (self.homePage) self.load(self.homePage);
    },
    load: function(name) {
        var self = this;
        var page = self.pages[name];
        if (!page) {
            alert("Invalid page: " + name);
            return;
        }
        self.content.load(page.url, function(response, status, xhr) {
            page.load();
        });
    }
});

var Dialog = Backbone.View.extend({
    initialize: function(options) {
        var self = this;
        Dialog.__super__.initialize.call(self, options);

        self.title = options.title;

        self.readonly = options.readonly;
        // by default all fields are editable
        if (self.readonly == undefined) self.readonly = [];

        self.actions = options.actions;
        if (self.actions == undefined) {
            // by default all buttons are active
            self.actions = [];
            self.$("button").each(function(index) {
                var button = $(this);
                var action = button.attr("name");
                self.actions.push(action);
            });
        }
    },
    render: function() {
        var self = this;

        if (self.title) {
            self.$("header h1").text(self.title);
        }

        self.$(".rcue-button-close").click(function(e) {
            self.close();
            e.preventDefault();
        });

        // set/unset readonly fields
        $("input", self.$el).each(function(index) {
            var input = $(this);
            var name = input.attr("name");
            if ( _.contains(self.readonly, name)) {
                input.attr("readonly", "readonly");
            } else {
                input.removeAttr("readonly");
            }
        });

        self.$("button").each(function(index) {
            var button = $(this);
            var action = button.attr("name");

            if (_.contains(self.actions, action)) {
                // enable buttons for specified actions
                button.show();
                button.click(function(e) {
                    self.performAction(action);
                    e.preventDefault();
                });
            } else {
                // hide unused buttons
                button.hide();
            }
        });

        self.loadFields();
        // save the fields back into model so the model
        // can detect which fields are changed
        self.saveFields();
    },
    performAction: function(action) {
        var self = this;

        if (action == "add") {
            self.add();

        } else if (action == "save") {
            self.save();

        } else {
            self.close();
        }
    },
    open: function() {
        var self = this;
        if (self.model.isNew()) {
            self.render();
            self.$el.show();
        } else {
            self.load();
        }
    },
    close: function() {
        var self = this;
        self.$el.hide();

        // remove event handlers
        self.$(".rcue-button-close").off("click");
        self.$("button").each(function(index) {
            var button = $(this);
            button.off("click");
        });
        self.trigger("close");
    },
    load: function() {
        var self = this;
        self.model.fetch({
            success: function(model, response, options) {
                self.render();
                self.$el.show();
            },
            error: function(model, response, options) {
                alert("ERROR: " + response);
            }
        });
    },
    loadFields: function() {
        var self = this;

        $("input", self.$el).each(function(index) {
            var input = $(this);
            self.loadField(input);
        });
    },
    loadField: function(input) {
        var self = this;
        var name = input.attr("name");
        var value = self.model.get(name);
        if (!value) value = "";
        input.val(value);
    },
    add: function() {
        var self = this;

        self.saveFields();

        var changedAttributes = self.model.changedAttributes();
        if (!changedAttributes) return;

        // save non-empty attributes with POST
        self.model.save(changedAttributes, {
            wait: true,
            success: function(model, response, options) {
                if (self.success) self.success.call();
                self.close();
            },
            error: function(model, response, options) {
                if (response.status == 201) {
                    if (self.success) self.success.call();
                    self.close();
                    return;
                }
                alert("ERROR: " + response.responseText);
                if (self.error) self.error.call();
            }
        });
    },
    save: function() {
        var self = this;

        self.saveFields();

        var changedAttributes = self.model.changedAttributes();
        if (!changedAttributes) return;

        // save changed attributes with PATCH
        self.model.save(changedAttributes, {
            patch: true,
            wait: true,
            success: function(model, response, options) {
                if (self.success) self.success.call();
                self.close();
            },
            error: function(model, response, options) {
                if (response.status == 200) {
                    if (self.success) self.success.call();
                    self.close();
                    return;
                }
                alert("ERROR: " + response.responseText);
                if (self.error) self.error.call();
            }
        });
    },
    saveFields: function() {
        var self = this;

        var attributes = {};
        $("input", self.$el).each(function(index) {
            var input = $(this);
            self.saveField(input, attributes);
        });
        self.model.set(attributes);
    },
    saveField: function(input, attributes) {
        var self = this;
        var name = input.attr("name");
        var value = input.val();
        attributes[name] = value;
    },
    done: function(success) {
        var self = this;
        self.success = success;
    },
    fail: function(error) {
        var self = this;
        self.error = error;
    }
});

var BlankTableItem = Backbone.View.extend({
    render: function() {
        var self = this;
        $("td:first", self.$el).each(function(index) {
            var item = $(this);
            item.html("&nbsp;");
        });
    }
});

var TableItem = Backbone.View.extend({
    initialize: function(options) {
        var self = this;
        TableItem.__super__.initialize.call(self, options);
        self.table = options.table;
    },
    render: function() {
        var self = this;
        $("td", self.$el).each(function(index) {
            var item = $(this);
            var name = item.attr("name");

            if (index == 0) {
                // find the checkbox and label for this item
                var checkbox = $("input[type='checkbox']", item);
                var id = checkbox.attr("id");
                var label = $("label[for='" + id + "']", item);

                // replace checkbox and label id with a unique id
                id = id + "_" + self.model.id;
                checkbox.attr("id", id);
                label.attr("for", id);

                // store item id as checkbox value
                checkbox.val(self.model.id);

            } else if (index == 1) {
                // setup link to edit dialog
                item.empty();
                $("<a/>", {
                    href: "#",
                    text: self.model.get(name),
                    click: function(e) {
                        var dialog = self.table.editDialog;
                        dialog.model = self.model;
                        dialog.once("close", function(event) {
                            self.render();
                        });
                        dialog.open();
                        e.preventDefault();
                    }
                }).appendTo(item);

            } else {
                // show cell content in plain text
                item.text(self.model.get(name));
                // update cell automatically on model change
                self.model.on("change:" + name, function(event) {
                    item.text(self.model.get(name));
                });
            }
        });
    }
});

var Table = Backbone.View.extend({
    initialize: function(options) {
        var self = this;

        Table.__super__.initialize.call(self, options);
        self.addDialog = options.addDialog;
        self.editDialog = options.editDialog;

        self.thead = $("thead", self.$el);

        // setup search field handler
        $("input[name='search']", self.thead).keypress(function(e) {
            if (e.which == 13) {
                var input = $(e.target);
                self.collection.filter(input.val());
                self.render();
            }
        });

        // setup add button handler
        $("button[name='add']", self.thead).click(function(e) {
            var dialog = self.addDialog;
            dialog.model = new self.collection.model();
            dialog.done(function() {
                self.render();
            });
            dialog.open();
        });

        // setup remove button handler
        $("button[name='remove']", self.thead).click(function(e) {
            var items = [];
            var message = "Are you sure you want to remove the following entries?\n";

            // get selected items
            $("input:checked", self.tbody).each(function(index) {
                var input = $(this);
                var id = input.val();
                items.push(id);
                message = message + " - " + id + "\n";
            });

            if (items.length == 0) return;
            if (!confirm(message)) return;

            _.each(items, function(id, index) {
                var model = self.collection.get(id);
                model.destroy({
                    wait: true
                });
            });

            self.render();
        });

        $("input[type='checkbox']", self.thead).click(function(e) {
            var checked = $(this).is(":checked");
            $("input[type='checkbox']", self.tbody).prop("checked", checked);
        });

        self.tbody = $("tbody", self.$el);
        self.template = $("tr", self.tbody).detach();

        // attach link handlers
        self.tfoot = $("tfoot", self.$el);
        $("a.prev", self.tfoot).click(function(e) {
            if (self.collection.link("prev") == undefined) return;
            self.collection.go("prev");
            self.render();
            e.preventDefault();
        });
        $("a.next", self.tfoot).click(function(e) {
            if (self.collection.link("next") == undefined) return;
            self.collection.go("next");
            self.render();
            e.preventDefault();
        });

        self.render();
    },
    render: function() {
        var self = this;
        self.collection.fetch({
            reset: true,
            success: function(collection, response, options) {
                self.tbody.empty();

                // display result page
                _(self.collection.models).each(function(model) {
                    var item = new TableItem({
                        el: self.template.clone(),
                        table: self,
                        model: model
                    });
                    item.render();
                    self.tbody.append(item.$el);
                }, self);

                // add blank lines
                if (self.collection.options.size != undefined) {
                    var blanks = self.collection.options.size - self.collection.models.length;
                    for (var i = 0; i < blanks; i++) {
                        var item = new BlankTableItem({
                            el: self.template.clone()
                        });
                        item.render();
                        self.tbody.append(item.$el);
                    }
                }
            },
            error: function(collection, response, options) {
                alert(response.statusText);
            }
        });
    }
});