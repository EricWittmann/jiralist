'use strict';

angular.module('myApp.services', ['ngResource'])

.factory('BugListService', [ '$rootScope',
	function($rootScope) {
		var nextId = 1;
		var allLists = {
		};
		
        if (localStorage['jira-list.next-id']) {
            nextId = parseInt(localStorage['jira-list.next-id']);
        }
		if (localStorage['jira-list.all-lists']) {
		    allLists = JSON.parse(localStorage['jira-list.all-lists']);
		}
		
		return {
			createList: function() {
				var id = nextId++;
				var list = {
					id: id.toString(),
					name: '<new list>',
					jira: 'http://localhost:12345/rest/api/2',
					jql: ''
				};
				allLists[id.toString()] = list;
				localStorage['jira-list.next-id'] = nextId.toString();
				return list;
			},
			saveList: function(bugList) {
				// TODO store the bug list in local storage
				allLists[bugList.id] = bugList;
				localStorage['jira-list.all-lists'] = JSON.stringify(allLists);
			},
            deleteList: function(bugList) {
                // TODO store the bug list in local storage
                delete allLists[bugList.id];
                localStorage['jira-list.all-lists'] = JSON.stringify(allLists);
            },
			getList: function(id) {
				return allLists[id];
			},
			getLists: function() {
				var rval = [];
				angular.forEach(allLists, function(value, key) {
					rval.push(value);
				})
				return rval;
			}
		}
	}])


.factory('DataService', [ 
    '$rootScope', 'BugListService', '$resource', '$timeout', '$interval',
    function($rootScope, BugListService, $resource, $timeout, $interval) {
        var statuses = {
        };
        var dataCache = {
        };
        var lastUpdated = {
        };
        var formatEndpoint = function(endpoint, params) {
            return endpoint.replace(/:(\w+)/g, function(match, key) {
                return params[key] ? params[key] : (':' + key);
            });
        };
        var toData = function(jiraResults) {
            var data = [];
            angular.forEach(jiraResults.issues, function(jiraIssue) {
                var issue = {
                        key: jiraIssue.key,
                        url: jiraIssue.self,
                        summary: jiraIssue.fields.summary,
                        status: jiraIssue.fields.status.name
                    };
                if (jiraIssue.fields.assignee) {
                    issue.assignee = jiraIssue.fields.assignee.displayName;
                    issue.avatar = jiraIssue.fields.assignee.avatarUrls['16x16'];
                }
                data.push(issue);
            });
            return data;
        };
        var setData = function(list, data) {
            if ($rootScope.activeList.id == list.id) {
                $rootScope.data = data;
            }
        };
        var refresh = function(list) {
            console.debug("Refreshing data for list: " + list.id);
            var status = statuses[list.id];
            if (status == 'refreshing') {
                return;
            }
            statuses[list.id] = 'refreshing';
            var endpoint = formatEndpoint(list.jira + '/search?fields=summary,assignee,status&maxResults=500&jql=:jql', 
                    { jql: encodeURIComponent(list.jql) });
            console.debug("Refresh data endpoint: " + endpoint);

            var username = list.username;
            var password = list.password;
            var enc = btoa(username + ':' + password);

            $resource(endpoint, {}, {
                search: { method:'GET', headers: { 'Authorization' : 'Basic ' + enc } }
            }).search(function(results) {
                statuses[list.id] = 'ok';
                var data = toData(results);
                dataCache[list.id] = data;
                lastUpdated[list.id] = Date.now();
                setData(list, data);
                console.info('OK');
            }, function(error) {
                statuses[list.id] = 'error';
                console.error(error);
            });
        };
        
        var fiveMinutes = 60000*5;
        $interval(function() {
            console.debug("!!! heartbeat !!!");
            var allLists = BugListService.getLists();
            var listToRefresh = null;
            var now = Date.now();
            angular.forEach(allLists, function(list) {
                if (!lastUpdated[list.id]) {
                    listToRefresh = list;
                    console.debug('** List never refreshed: ' + list.name);
                } else {
                    var ttl = lastUpdated[list.id] + fiveMinutes;
                    if (now > ttl) {
                        listToRefresh = list;
                        console.debug('** List needs refresh (ttl): ' + list.name);
                    }
                }
            });
            if (listToRefresh) {
                refresh(listToRefresh);
            }
        }, 10000);
        
        return {
            loadData: function(list) {
                if (list.id == '-1') {
                    console.log('Aborting due to list.id == -1');
                    return;
                }
                if (!dataCache[list.id]) {
                    console.log('Could not find data in cache for: ' + list.id);
                    $timeout(function() {
                        setData(list, []);
                        refresh(list);
                    });
                } else {
                    console.log('Found cached data for: ' + list.id);
                    $timeout(function() {
                        setData(list, dataCache[list.id]);
                    });
                }
            },
            refreshData: function(list) {
                refresh(list);
            }
        }
    }])


;