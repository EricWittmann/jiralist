'use strict';

angular.module('myApp.controllers', ['myApp.services'])

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
        console.log("Done: " + JSON.stringify($rootScope.lists));
    }])

.controller('BugListController', [
    '$scope', '$rootScope', 'BugListService', 'DataService', 'JiraService',
    function($scope, $rootScope, BugListService, DataService, JiraService) {
        console.log('Running the bug list controller.');
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
            if ($scope.settings.fixVersion) {
                $scope.versions = [ $scope.settings.fixVersion ];
            }
        });
        
        $scope.$watch('settings', function(newValue) {
            $scope.isDirty = !angular.equals($scope.settings, $scope.originalSettings)
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

        $scope.refreshVersions = function() {
            $('#refresh-fix-versions').prop('disabled', true);
            $('#refresh-fix-versions i').addClass('fa-spin');
            JiraService.listVersions($scope.settings.jira, $scope.settings.username, $scope.settings.password, 
                    $scope.settings.project, function(results) 
            {
                var filteredVersions = [];
                angular.forEach(results, function(version) {
                    if (!version.released) {
                        filteredVersions.push(version);
                    }
                });
                $scope.versions = filteredVersions;
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
            $scope.refreshVersions();
            $scope.refreshIssueTypes();
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
            $scope.isDirty = !angular.equals($scope.settings, $scope.originalSettings)
            DataService.refreshData($scope.settings);
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
    }])

;