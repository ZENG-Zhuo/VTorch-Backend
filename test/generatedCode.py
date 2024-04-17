
import torch

import torch.nn

class MyModel_layers(torch.nn.Module):
    def __init__(self):
        super().__init__()
        self.node3 = torch.nn.Identity()
        self.node1 = torch.nn.Conv2d(in_channels=1,out_channels=1,kernel_size=1,stride=1)
        self.node2 = torch.nn.AvgPool2d(kernel_size=(1,1),ceil_mode=True)
        self.node4 = torch.nn.L1Loss()
    def forward(self, x):
        y = self.node3(input=x)
        z = self.node1(input=x)
        a = self.node2(input=z)
        b = self.node4(input=a,target=y)
        return b

class MyModel_train():
    def __init__(self):
        self.node5 = torch.nn.Tanh()
    def train(self):
        model = MyModel_layers()
        optimizer = torch.nn.Adam()
        for batch_idx, data, target in enumerate(data_loader):
            x = model(data)
            y = self.node5(input=x)
            final_loss = y
            optimizer.zero_grad()
            final_loss.backward()
            optimizer.step()
            if ((batch_idx%100)==0):
                print()
            else:
                pass