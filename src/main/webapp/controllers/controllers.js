'use strict';

angular.module('myApp.controllers', ['myApp.services', 'ngAnimate'])

.controller('LeftPanelController', [
    '$scope', '$rootScope', 'BugListService',
    function($scope, $rootScope, BugListService) {
        console.log('Running the left-hand panel controller.');

        $scope.newList = function() {
            console.info("Creating a new issue list.");

            var list = BugListService.createList();

            $rootScope.activeList = list;
            $rootScope.lists = BugListService.getLists();

            console.info("List created: " + JSON.stringify(list));

            $('#right-panel .nav-tabs a[href="#settings"]').tab('show')
            $('#settings-name').focus();
        };

        $scope.isActive = function(list) {
            return (list.id == $rootScope.activeList.id);
        };

        $scope.selectList = function(list) {
            console.info("Changing the active list: " + JSON.stringify(list));

            $rootScope.activeList = list;
        };

        console.log("Getting all the lists.");

        $rootScope.lists = BugListService.getLists();
        $rootScope.activeList = {
            id: '-1'
        };

        //console.log("Done: " + JSON.stringify($rootScope.lists));
    }])

.controller('BugListController', [
    '$scope', '$rootScope', 'BugListService', 'DataService', 'JiraService',
    function($scope, $rootScope, BugListService, DataService, JiraService) {
        console.log('Running the bug list controller.');

        $scope.predicate = 'key';
        $scope.reverse = true;
        $scope.selectedPriority = null;
        
        $scope.order = function(predicate) {
          $scope.reverse = ($scope.predicate === predicate) ? !$scope.reverse : false;
          $scope.predicate = predicate;
        };

        // Show/Hide the Edit Icon for Priorities on Hover
        $scope.hoverIn = function(){
            this.hoverEdit = true;
        };

        $scope.hoverOut = function(){
            this.hoverEdit = false;
        };
        
        $rootScope.$watch('activeList', function(newValue) {
            if (!newValue || newValue.id == '-1') {
                return;
            }

            console.log("event: active list changed: " + JSON.stringify(newValue));

            $scope.settings = angular.copy(newValue);
            $scope.originalSettings = newValue;
            $rootScope.data = DataService.loadData(newValue);

            if ($scope.settings.project) {
                $scope.projects = [ $scope.settings.project ];
            }

            if ($scope.settings.versions) {
                $scope.versions = $scope.settings.versions;
            } else if ($scope.settings.fixVersion) {
                $scope.versions = [ $scope.settings.fixVersion ];
            }

            $scope.refreshPriorities();
        });

        $scope.$watch('myStuffOnly', function(newValue) {
            if (newValue) {
                $scope.assigneeIdFilter = $rootScope.activeList.username;
            } else {
                delete $scope.assigneeIdFilter;
            }

            console.log('$scope.assigneeFilter == ' + $scope.assigneeFilter);
        });

        $scope.$watch('settings', function(newValue) {
            $scope.isDirty = !angular.equals($scope.settings, $scope.originalSettings);
            var valid = false;

            if (newValue) {
                valid = newValue.name && newValue.project && newValue.fixVersion && newValue.issueTypes;
            }

            $scope.isValid = valid;
        }, true);
        
        $scope.refreshProjects = function() {
            $('#refresh-projects').prop('disabled', true);
            $('#refresh-projects i').addClass('fa-spin');
            JiraService.listProjects($scope.settings.jira, $scope.settings.username, $scope.settings.password, function(results) {
                console.log('Projects refreshed: ' + JSON.stringify(results));

                $scope.projects = results;
                $('#refresh-projects').prop('disabled', false);
                $('#refresh-projects i').removeClass('fa-spin');
            }, function(error) {
                $scope.projects = [];
                $('#refresh-projects').prop('disabled', false);
                $('#refresh-projects i').removeClass('fa-spin');
                alert("Error refreshing projects: " + JSON.stringify(error));
            });
        };


        $scope.refreshPriorities = function() {
            JiraService.listPriorities($scope.settings.jira, $scope.settings.username, $scope.settings.password, function(results) {
                $scope.priorities = results;
            }, function(error) {
                console.log('Error refreshing priorities: ' + JSON.stringify(error));
            });
        };

        $scope.refreshVersions = function() {
            $('#refresh-fix-versions').prop('disabled', true);
            $('#refresh-fix-versions i').addClass('fa-spin');
            JiraService.listVersions($scope.settings.jira, $scope.settings.username, $scope.settings.password,
                    $scope.settings.project, function(results)
            {
                var unreleasedVersions = [];
                angular.forEach(results, function(version) {
                    if (!version.released) {
                        unreleasedVersions.push(version);
                    }
                });

                $scope.versions = unreleasedVersions;
                $('#refresh-fix-versions').prop('disabled', false);
                $('#refresh-fix-versions i').removeClass('fa-spin');
            }, function(error) {
                $scope.versions = [];
                $('#refresh-fix-versions').prop('disabled', false);
                $('#refresh-fix-versions i').removeClass('fa-spin');
                alert("Error refreshing versions: " + JSON.stringify(error));
            });
        };

        $scope.refreshIssueTypes = function() {
            $('#refresh-issue-types').prop('disabled', true);
            $('#refresh-issue-types i').addClass('fa-spin');
            JiraService.listIssueTypes($scope.settings.jira, $scope.settings.username, $scope.settings.password,
                    $scope.settings.project, function(results)
            {
                var filteredIssueTypes = [];
                angular.forEach(results, function(issueType) {
                    if (!issueType.subtask) {
                        filteredIssueTypes.push(issueType);
                    }
                });
                console.log("Issue Types: " + JSON.stringify(filteredIssueTypes));
                $scope.settings.issueTypes = filteredIssueTypes;
                $('#refresh-issue-types').prop('disabled', false);
                $('#refresh-issue-types i').removeClass('fa-spin');
            }, function(error) {
                $scope.issueTypes = [];
                $('#refresh-issue-types').prop('disabled', false);
                $('#refresh-issue-types i').removeClass('fa-spin');
                alert("Error refreshing issue types: " + JSON.stringify(error));
            });
        };

        $scope.refreshBoth = function() {
            $scope.refreshPriorities();
            $scope.refreshVersions();
            $scope.refreshIssueTypes();
        };

        $scope.refreshList = function() {
            DataService.refreshData($scope.activeList);
        };

        $scope.openNewIssueDialog = function() {
            $scope.newIssue = {
                type: $scope.settings.issueTypes[0]
            };
            $('#newIssueModal').modal();
        };
        $scope.createNewIssue = function(newIssue) {
            console.log('Creating new issue: ' + JSON.stringify(newIssue));
            DataService.newIssue($scope.activeList, newIssue);
        };

        $scope.saveSettings = function() {
            BugListService.saveList($scope.settings);
            $rootScope.lists = BugListService.getLists();
            $rootScope.activeList = $scope.settings;
            $scope.originalSettings = angular.copy($scope.settings);
            $scope.isDirty = !angular.equals($scope.settings, $scope.originalSettings);
            DataService.refreshData($scope.settings);
        };

        $scope.savePriority = function(issue, priority) {
            var request = {
                'fields': { 'priority': priority
                }
            };

            var that = this;
            that.editorEnabled = false;

            DataService.savePriority($scope.activeList, issue, priority).put(request, function(result) {
                issue.priority = result.fields.priority;
            }, function(error) {
                console.log('Error saving priority for issue: ' + JSON.stringify(error));
            });
        };

        $scope.cancelSettings = function() {
            $scope.settings = angular.copy($scope.originalSettings);
        };

        $scope.deleteSettings = function() {
            BugListService.deleteList($scope.settings);
            $rootScope.lists = BugListService.getLists();
            $rootScope.activeList = {
                id: '-1'
            }
        };

        $scope.openMarkAsDoneDialog = function(issue) {
            console.log('Showing Mark As Done dialog for: "'+issue.summary+'".');
            $scope.madData = {
                issue: issue,
                fixedIn: $scope.activeList.finalVersions[0]
            };
            $('#markAsDoneModal').modal();
        };

        $scope.assignToMe = function(issue) {
            var me = $scope.activeList.username;
            DataService.assign($scope.activeList, issue, me);
        };

        $scope.startProgress = function(issue) {
            issue.status = 'Coding In Progress';
            var list = $scope.activeList;
            // Fetch transitions from JIRA
            JiraService.listTransitions($scope.settings.jira, $scope.settings.username, $scope.settings.password, issue.key, function(results) {
                // Select the "Start Progress" transition
                var startTransition;
                angular.forEach(results, function(transition) {
                    if (transition.name == 'Start Progress') {
                        startTransition = transition;
                    }
                });
                if (startTransition) {
                    // Perform the "Resolve" transition
                    console.log('Starting Progress on issue using transition: ' + JSON.stringify(startTransition));
                    DataService.startOrStop(list, issue, startTransition);
                } else {
                    console.log('Failed to find transition.');
                }

            }, function(error) {
                alert('Failed to list transitions for issue: ' + JSON.stringify(error));
            });
        };

        $scope.stopProgress = function(issue) {
            issue.status = 'Open';
            var list = $scope.activeList;
            // Fetch transitions from JIRA
            JiraService.listTransitions($scope.settings.jira, $scope.settings.username, $scope.settings.password, issue.key, function(results) {
                // Select the "Start Progress" transition
                var stopTransition;
                angular.forEach(results, function(transition) {
                    if (transition.name == 'Stop Progress') {
                        stopTransition = transition;
                    }
                });
                if (stopTransition) {
                    // Perform the "Resolve" transition
                    console.log('Stopping Progress on issue using transition: ' + JSON.stringify(stopTransition));
                    DataService.startOrStop(list, issue, stopTransition);
                } else {
                    console.log('Failed to find transition.');
                }

            }, function(error) {
                alert('Failed to list transitions for issue: ' + JSON.stringify(error));
            });
        };

        $scope.markAsDone = function(madData) {
            console.log('Attempting to mark issue "'+madData.issue.summary+'" as done.');

            // Remove item from list
            var index;
            var found = false;
            var list = $scope.activeList;

            console.log('Finding issue with key: ' + madData.issue.key);

            angular.forEach($scope.data, function(dissue, i) {
                if (dissue.key == madData.issue.key) {
                    index = i;
                    found = true;
                }
            });

            if (found) {
                console.log('Data item (issue) at index ' + index + ' will be removed.');
                $scope.data.splice(index, 1);
            } else {
                console.log('Issue not found in data: ' + madData.issue.summary);
            }

            // Fetch transitions from JIRA
            JiraService.listTransitions($scope.settings.jira, $scope.settings.username, $scope.settings.password, madData.issue.key, function(results) {
                // Select the "Resolve" transition
                var resolveTransition;

                angular.forEach(results, function(transition) {
                    if (transition.name == 'Resolve Issue') {
                        resolveTransition = transition;
                    }
                });

                if (resolveTransition) {
                    // Perform the "Resolve" transition
                    console.log('Resolving issue using transition: ' + JSON.stringify(resolveTransition));
                    DataService.resolve(list, madData, resolveTransition);
                } else {
                    console.log('Failed to find transition.');
                }

            }, function(error) {
                alert('Failed to list transitions for issue: ' + JSON.stringify(error));
            });
        };
    }])

;