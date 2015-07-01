'use strict';


var formatEndpoint = function(endpoint, params) {
    return endpoint.replace(/:(\w+)/g, function(match, key) {
        return params[key] ? params[key] : (':' + key);
    });
};


angular.module('myApp.services', ['ngResource', 'ngAnimate'])

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
					jira: 'https://issues.jboss.org/rest/api/2'
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


.factory('JiraService', [
    '$rootScope', 'BugListService', '$resource', '$timeout', '$interval',
    function($rootScope, BugListService, $resource, $timeout, $interval) {
        return {
            listProjects: function(jira, username, password, handler, errorHandler) {
                var endpoint = formatEndpoint('proxy/project', {});
                console.debug("Listing all projects: " + endpoint);
                var enc = btoa(username + ':' + password);
                $resource(endpoint, {}, {
                    search: { method:'GET', isArray: true, headers: { 'Authorization' : 'Basic ' + enc } }
                }).search(handler, errorHandler);
            },
            listVersions: function(jira, username, password, project, handler, errorHandler) {
                var endpoint = formatEndpoint('proxy/project/:key/versions', { key: project.key });
                console.debug("Listing all versions: " + endpoint);
                var enc = btoa(username + ':' + password);
                $resource(endpoint, {}, {
                    search: { method:'GET', isArray: true, headers: { 'Authorization' : 'Basic ' + enc } }
                }).search(handler, errorHandler);
            },
            listIssueTypes: function(jira, username, password, project, handler, errorHandler) {
                var endpoint = formatEndpoint('proxy/issue/createmeta?projectKeys=:key', { key: project.key });
                console.debug("Listing all issue types: " + endpoint);
                var enc = btoa(username + ':' + password);
                $resource(endpoint, {}, {
                    search: { method:'GET', isArray: false, headers: { 'Authorization' : 'Basic ' + enc } }
                }).search(function(result) {
                    console.debug("Issue types: " + JSON.stringify(result));
                    if (handler && result.projects[0] && result.projects[0].issuetypes) {
                        handler(result.projects[0].issuetypes);
                    } else {
                        handler(null);
                    }
                }, errorHandler);
            },
            listTransitions: function(jira, username, password, issueKey, handler, errorHandler) {
                var endpoint = formatEndpoint('proxy/issue/:issueKey/transitions', { issueKey: issueKey });
                console.debug("Listing issue transitions: " + endpoint);
                var enc = btoa(username + ':' + password);
                $resource(endpoint, {}, {
                    search: { method:'GET', isArray: false, headers: { 'Authorization' : 'Basic ' + enc } }
                }).search(function(result) {
                    if (handler) {
                        handler(result.transitions);
                    }
                }, errorHandler);
            },
        }
    }])


.factory('DataService', [ 
    '$rootScope', 'BugListService', '$resource', '$timeout', '$interval',
    function($rootScope, BugListService, $resource, $timeout, $interval) {
        var idCounter = 100;
        var statuses = {
        };
        var dataCache = {
        };
        var lastUpdated = {
        };
        var toData = function(jiraResults) {
            var data = [];
            angular.forEach(jiraResults.issues, function(jiraIssue) {
                var issue = {
                        key: jiraIssue.key,
                        url: jiraIssue.self,
                        summary: jiraIssue.fields.summary,
                        description: jiraIssue.fields.description,
                        status: jiraIssue.fields.status.name,
                        type: jiraIssue.fields.issuetype.name,
                        icon: jiraIssue.fields.issuetype.iconUrl
                    };
                if (jiraIssue.fields.assignee) {
                    issue.assignee = jiraIssue.fields.assignee.displayName;
                    issue.assigneeId = jiraIssue.fields.assignee.name;
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
            console.debug("Refreshing data for list: " + list.name);
            var status = statuses[list.id];
            if (status == 'refreshing') {
                return;
            }
            if (!list.project || !list.fixVersion) {
                return;
            }
            statuses[list.id] = 'refreshing';
            $rootScope.refreshing = true;
            var jql = 'project = ' + list.project.key + ' AND resolution = Unresolved AND fixVersion = ' + list.fixVersion.name + ' ORDER BY key DESC';
            var endpoint = formatEndpoint('proxy/search?fields=summary,assignee,issuetype,status&maxResults=500&jql=:jql', 
                    { jql: encodeURIComponent(jql) });
            console.debug("Refresh data endpoint: " + endpoint);

            var username = list.username;
            var password = list.password;
            var enc = btoa(username + ':' + password);

            $resource(endpoint, {}, {
                search: { method:'GET', headers: { 'Authorization' : 'Basic ' + enc } }
            }).search(function(results) {
                $rootScope.refreshing = false;
                statuses[list.id] = 'ok';
                var data = toData(results);
                dataCache[list.id] = data;
                lastUpdated[list.id] = Date.now();
                setData(list, data);
                console.info('OK');
            }, function(error) {
                $rootScope.refreshing = false;
                statuses[list.id] = 'error';
                console.error(error);
            });
        };
        
        var thirtySeconds = 30000;
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
                    var ttl = lastUpdated[list.id] + thirtySeconds;
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
                    console.log('Could not find data in cache for: ' + list.name);
                    $timeout(function() {
                        setData(list, []);
                        refresh(list);
                    });
                } else {
                    console.log('Found cached data for: ' + list.name);
                    $timeout(function() {
                        setData(list, dataCache[list.id]);
                    });
                }
            },
            startOrStop: function(list, issue, transition) {
                var username = list.username;
                var password = list.password;
                var enc = btoa(username + ':' + password);
                var transitionReq = {
                    transition: {
                        id: transition.id
                    }
                };

                // Transition to "In Progress"
                var transitionEndpoint = formatEndpoint('proxy/issue/:issueKey/transitions', { issueKey: issue.key });
                console.debug("Issuing the 'start' transition @ transitionEndpoint: " + transitionEndpoint);
                $resource(transitionEndpoint, {}, {
                    post: { method:'POST', headers: { 'Authorization' : 'Basic ' + enc } }
                }).post(transitionReq, function(result) {
                    // OK it's done!
                }, function(error) {
                    alert('Error starting progress on issue: ' + JSON.stringify(error));
                });
            },
            assign: function(list, issue, who) {
                var username = list.username;
                var password = list.password;
                var enc = btoa(username + ':' + password);
                
                var assignReq = {
                    name: who
                };
                
                issue.assignee = who;
                issue.assigneeId = who;
                issue.avatar = '';

                // Assign the issue to the new user
                var assignEndpoint = formatEndpoint('proxy/issue/:issueKey/assignee', { issueKey: issue.key });
                console.debug("Assigning the issue via endpoint: " + assignEndpoint);
                $resource(assignEndpoint, {}, {
                    put: { method:'PUT', headers: { 'Authorization' : 'Basic ' + enc } }
                }).put(assignReq, function(result) {
                    // OK it's done!
                    
                    // Now fetch the new issue so we can extract some additional information from
                    // it like the 'assignee', which is not returned when the issue is created.
                    var fetchEndpoint = formatEndpoint('proxy/issue/:issueKey', { issueKey: issue.key });
                    $resource(fetchEndpoint, {}, {
                        get: { method:'GET', isArray: false, headers: { 'Authorization' : 'Basic ' + enc } }
                    }).get(function(result) {
                        issue.assignee = result.fields.assignee.displayName;
                        issue.assigneeId = result.fields.assignee.name;
                        issue.avatar = result.fields.assignee.avatarUrls['16x16'];
                        issue.type = result.fields.issuetype.name;
                        issue.icon = result.fields.issuetype.iconUrl;
                    });
                }, function(error) {
                    // TODO: Handle the error appropriately - probably by restoring the 
                    alert('Error assigning issue to user: ' + JSON.stringify(error));
                });
            },
            resolve: function(list, madData, transition) {
                var username = list.username;
                var password = list.password;
                var enc = btoa(username + ':' + password);
                var updateReq = {
                    update: {
                        fixVersions: [
                            {
                                add: madData.fixedIn
                            }
                        ]
                    },
                    fields: {
                        customfield_12310220: madData.pr
                    }
                };
                var transitionReq = {
                    transition: {
                        id: transition.id
                    }
                };

                // Update the issue with the fix version and git PR/commit link
                var updateEndpoint = formatEndpoint('proxy/issue/:issueKey', { issueKey: madData.issue.key });
                console.debug("Issuing the transition @ updateEndpoint: " + updateEndpoint);
                $resource(updateEndpoint, {}, {
                    put: { method:'PUT', headers: { 'Authorization' : 'Basic ' + enc } }
                }).put(updateReq, function(result) {
                    // OK it's done!
                }, function(error) {
                    // TODO: Handle the error appropriately - probably by restoring the 
                    alert('Error marking issue resolved: ' + JSON.stringify(error));
                });

                // Transition to "Resolved"
                var transitionEndpoint = formatEndpoint('proxy/issue/:issueKey/transitions', { issueKey: madData.issue.key });
                console.debug("Issuing the transition @ transitionEndpoint: " + transitionEndpoint);
                $resource(transitionEndpoint, {}, {
                    post: { method:'POST', headers: { 'Authorization' : 'Basic ' + enc } }
                }).post(transitionReq, function(result) {
                    // OK it's done!
                }, function(error) {
                    // TODO: Handle the error appropriately - probably by restoring the 
                    alert('Error marking issue resolved: ' + JSON.stringify(error));
                });
            },
            newIssue: function(list, issue) {
                var dataItem;
                if (dataCache[list.id]) {
                    console.log('Creating new issue from: ' + JSON.stringify(issue));
                    var data = dataCache[list.id];
                    dataItem = {
                            id: idCounter++,
                            key: '???',
                            url: '',
                            summary: issue.summary,
                            description: issue.description,
                            status: 'Open',
                            assignee: 'TBD'
                    };
                    data.unshift(dataItem);
                }
                
                var jiraIssue = {
                    fields: {
                        project: {
                            id: list.project.id
                        },
                        summary: issue.summary,
                        issuetype: {
                            id: issue.type.id
                        },
                        fixVersions: [
                          {
                              id: list.fixVersion.id
                          }
                        ],
                        description: issue.description
                    }
                };

                var endpoint = 'proxy/issue';
                console.debug("Create Issue endpoint: " + endpoint);
                console.debug('POSTing Issue: ' + JSON.stringify(jiraIssue));
                var username = list.username;
                var password = list.password;
                var enc = btoa(username + ':' + password);
                $resource(endpoint, {}, {
                    create: { method:'POST', isArray: false, headers: { 'Authorization' : 'Basic ' + enc } }
                }).create(jiraIssue, function(result) {
                    if (dataItem) {
                        dataItem.id = result.id;
                        dataItem.key = result.key;
                        dataItem.url = result.self;
                    }
                    console.info('Issue created successfully.');
                    
                    // Now fetch the new issue so we can extract some additional information from
                    // it like the 'assignee', which is not returned when the issue is created.
                    endpoint = 'proxy/issue/' + result.key;
                    $resource(endpoint, {}, {
                        get: { method:'GET', isArray: false, headers: { 'Authorization' : 'Basic ' + enc } }
                    }).get(function(result) {
                        dataItem.assignee = result.fields.assignee.displayName;
                        dataItem.assigneeId = result.fields.assignee.name;
                        dataItem.avatar = result.fields.assignee.avatarUrls['16x16'];
                    });
                }, function(error) {
                    alert('Failed to create issue "' + issue.summary + '":' + JSON.stringify(error));
                    // TODO - remove the issue from the list
                });
            },
            refreshData: function(list) {
                refresh(list);
            }
        }
    }])


;