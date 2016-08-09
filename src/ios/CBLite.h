#import <Cordova/CDV.h>
#import "CBLManager.h"

@interface CBLite : CDVPlugin

@property (nonatomic, strong) NSURL *liteURL;
@property (nonatomic, strong) CBLManager *dbmgr;

- (void)getURL:(CDVInvokedUrlCommand*)urlCommand;
- (void)stopReplication:(CDVInvokedUrlCommand*)urlCommand;
- (void)launchCouchbaseLite:(CDVInvokedUrlCommand*)urlCommand;

@end

