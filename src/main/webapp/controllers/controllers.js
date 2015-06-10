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
    '$scope', '$rootScope', 'BugListService', 'DataService',
    function($scope, $rootScope, BugListService, DataService) {
        console.log('Running the bug list controller.');
        $rootScope.$watch('activeList', function(newValue) {
            if (!newValue || newValue.id == '-1') {
                return;
            }
            console.log("event: active list changed: " + JSON.stringify(newValue));
            $scope.settings = angular.copy(newValue);
            $scope.originalSettings = newValue;
            $rootScope.data = DataService.loadData(newValue);
        });
        
        $scope.$watch('settings', function() {
            $scope.isDirty = !angular.equals($scope.settings, $scope.originalSettings)
        }, true);
        
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